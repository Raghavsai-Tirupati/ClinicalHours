import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing required environment variables: SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY)');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface Opportunity {
  id: string;
  name: string;
  location: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  type?: string;
}

interface CoordinateAnalysis {
  total: number;
  valid: number;
  invalid: number;
  missing: number;
  duplicates: number;
  duplicateGroups: Map<string, string[]>;
  coordinateDistribution: Map<string, number>;
}

// Check if coordinates are valid (within US bounds roughly)
function isValidCoordinate(lat: number | null, lon: number | null): boolean {
  if (lat === null || lon === null || isNaN(lat) || isNaN(lon)) {
    return false;
  }
  return lat >= 24 && lat <= 50 && lon >= -130 && lon <= -65;
}

// Analyze coordinate distribution and find duplicates
function analyzeCoordinates(opportunities: Opportunity[]): CoordinateAnalysis {
  const valid: Opportunity[] = [];
  const invalid: Opportunity[] = [];
  const missing: Opportunity[] = [];
  const coordMap = new Map<string, string[]>();
  const coordinateDistribution = new Map<string, number>();

  opportunities.forEach(opp => {
    if (opp.latitude === null || opp.longitude === null) {
      missing.push(opp);
    } else if (!isValidCoordinate(opp.latitude, opp.longitude)) {
      invalid.push(opp);
    } else {
      valid.push(opp);
      // Round to 4 decimal places (~11 meters) to detect duplicates
      const key = `${opp.latitude.toFixed(4)},${opp.longitude.toFixed(4)}`;
      if (!coordMap.has(key)) {
        coordMap.set(key, []);
        coordinateDistribution.set(key, 0);
      }
      coordMap.get(key)!.push(opp.id);
      coordinateDistribution.set(key, coordinateDistribution.get(key)! + 1);
    }
  });

  // Find duplicate coordinate groups (more than 1 opportunity at same location)
  const duplicateGroups = new Map<string, string[]>();
  let duplicateCount = 0;
  coordMap.forEach((ids, key) => {
    if (ids.length > 1) {
      duplicateGroups.set(key, ids);
      duplicateCount += ids.length;
    }
  });

  return {
    total: opportunities.length,
    valid: valid.length,
    invalid: invalid.length,
    missing: missing.length,
    duplicates: duplicateCount,
    duplicateGroups,
    coordinateDistribution,
  };
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${minutes}m ${secs}s`;
}

async function fixMapCoordinates(forceRegeocode: boolean = true, startFromBatch: number = 0) {
  console.log('🗺️  Fixing map coordinates for all opportunities...\n');
  console.log(`📋 Mode: ${forceRegeocode ? 'Force re-geocode ALL opportunities' : 'Only fix invalid/duplicate coordinates'}\n`);

  const startTime = Date.now();

  try {
    // Get all opportunities
    const { data: opportunities, error } = await supabase
      .from('opportunities')
      .select('id, name, location, address, latitude, longitude, type')
      .order('name');

    if (error) {
      console.error('❌ Error fetching opportunities:', error);
      return;
    }

    if (!opportunities || opportunities.length === 0) {
      console.log('✅ No opportunities found');
      return;
    }

    console.log(`📊 Found ${opportunities.length} total opportunities\n`);

    // Analyze coordinate distribution
    console.log('🔍 Analyzing coordinate distribution...\n');
    const analysis = analyzeCoordinates(opportunities);

    console.log('='.repeat(60));
    console.log('📊 COORDINATE ANALYSIS');
    console.log('='.repeat(60));
    console.log(`Total opportunities:     ${analysis.total}`);
    console.log(`✅ Valid coordinates:    ${analysis.valid}`);
    console.log(`❌ Invalid coordinates:  ${analysis.invalid}`);
    console.log(`⚠️  Missing coordinates: ${analysis.missing}`);
    console.log(`🔄 Duplicate coordinates: ${analysis.duplicates}`);
    console.log('='.repeat(60));

    // Show duplicate groups (top 10)
    if (analysis.duplicateGroups.size > 0) {
      console.log('\n🔄 Top duplicate coordinate groups:\n');
      const sortedGroups = Array.from(analysis.duplicateGroups.entries())
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 10);
      
      sortedGroups.forEach(([coords, ids], index) => {
        console.log(`   ${index + 1}. ${coords} - ${ids.length} opportunities`);
      });
      
      if (analysis.duplicateGroups.size > 10) {
        console.log(`   ... and ${analysis.duplicateGroups.size - 10} more duplicate groups`);
      }
      console.log('');
    }

    // Determine which opportunities need geocoding
    let opportunitiesToGeocode: Opportunity[];
    if (forceRegeocode) {
      opportunitiesToGeocode = opportunities;
      console.log(`\n🌍 Force re-geocoding: Processing ALL ${opportunities.length} opportunities\n`);
    } else {
      // Only process invalid, missing, or duplicates
      const duplicateIds = new Set<string>();
      analysis.duplicateGroups.forEach(ids => {
        ids.forEach(id => duplicateIds.add(id));
      });

      opportunitiesToGeocode = opportunities.filter(opp => {
        const isValid = isValidCoordinate(opp.latitude, opp.longitude);
        const isDuplicate = duplicateIds.has(opp.id);
        return !isValid || isDuplicate;
      });

      console.log(`\n🌍 Geocoding: Processing ${opportunitiesToGeocode.length} opportunities (invalid/missing/duplicates)\n`);
    }

    if (opportunitiesToGeocode.length === 0) {
      console.log('\n✅ All opportunities have valid, unique coordinates!');
      return;
    }

    // Process in batches
    const BATCH_SIZE = 50; // Increased batch size for efficiency
    const totalBatches = Math.ceil(opportunitiesToGeocode.length / BATCH_SIZE);
    const batchesToProcess = totalBatches - startFromBatch;
    
    if (startFromBatch > 0) {
      console.log(`\n⏩ Resuming from batch ${startFromBatch + 1} of ${totalBatches}\n`);
    }

    console.log(`📦 Processing ${batchesToProcess} batches (${BATCH_SIZE} opportunities per batch)`);
    console.log(`   Estimated time: ~${formatDuration((opportunitiesToGeocode.length * 0.1) / 60 * 100)} (at ~10 req/sec)\n`);

    let totalGeocoded = 0;
    let totalFailed = 0;
    let processedCount = 0;

    for (let i = startFromBatch; i < totalBatches; i++) {
      const batchStart = i * BATCH_SIZE;
      const batchEnd = Math.min(batchStart + BATCH_SIZE, opportunitiesToGeocode.length);
      const batch = opportunitiesToGeocode.slice(batchStart, batchEnd);
      const batchNum = i + 1;
      
      const progress = ((processedCount / opportunitiesToGeocode.length) * 100).toFixed(1);
      const elapsed = (Date.now() - startTime) / 1000;
      const avgTimePerItem = elapsed / Math.max(processedCount, 1);
      const remaining = opportunitiesToGeocode.length - processedCount;
      const etaSeconds = remaining * avgTimePerItem;
      const eta = formatDuration(etaSeconds);

      console.log(`\n📦 Batch ${batchNum}/${totalBatches} [${progress}%]`);
      console.log(`   Processing ${batch.length} opportunities...`);
      if (processedCount > 0) {
        console.log(`   ETA: ${eta}`);
      }

      try {
        const { data, error } = await supabase.functions.invoke('fix-coordinates', {
          body: {
            opportunityIds: batch.map(opp => opp.id),
            batchSize: BATCH_SIZE,
            forceRegeocode: forceRegeocode,
          },
        });

        if (error) {
          console.error(`   ❌ Edge function error: ${error.message}`);
          totalFailed += batch.length;
          processedCount += batch.length;
          continue;
        }

        if (data?.error) {
          console.error(`   ❌ Error: ${data.error}`);
          totalFailed += batch.length;
          processedCount += batch.length;
          continue;
        }

        if (!data?.success) {
          console.error(`   ❌ Unexpected response:`, data);
          totalFailed += batch.length;
          processedCount += batch.length;
          continue;
        }

        const geocoded = data.geocoded || 0;
        const failed = data.failed || 0;
        totalGeocoded += geocoded;
        totalFailed += failed;
        processedCount += batch.length;

        console.log(`   ✅ Geocoded: ${geocoded}`);
        if (failed > 0) {
          console.log(`   ❌ Failed: ${failed}`);
          if (data.failures && data.failures.length > 0) {
            console.log(`   Failed opportunities:`);
            data.failures.slice(0, 3).forEach((f: any) => {
              console.log(`     - ${f.name}: ${f.error}`);
            });
            if (data.failures.length > 3) {
              console.log(`     ... and ${data.failures.length - 3} more`);
            }
          }
        }

        // Rate limiting between batches (500ms pause)
        if (i < totalBatches - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

      } catch (error) {
        console.error(`   ❌ Exception:`, error);
        totalFailed += batch.length;
        processedCount += batch.length;
      }
    }

    const totalTime = (Date.now() - startTime) / 1000;

    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 GEOCODING SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successfully geocoded: ${totalGeocoded}`);
    console.log(`❌ Failed:               ${totalFailed}`);
    console.log(`📝 Total processed:      ${processedCount}`);
    console.log(`⏱️  Total time:           ${formatDuration(totalTime)}`);
    console.log(`📊 Success rate:         ${((totalGeocoded / processedCount) * 100).toFixed(1)}%`);
    console.log('='.repeat(60));

    if (totalFailed > 0) {
      console.log(`\n⚠️  ${totalFailed} opportunities failed to geocode`);
      console.log(`   You can run the script again to retry failed entries`);
    } else {
      console.log(`\n🎉 All opportunities processed successfully!`);
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const forceRegeocode = !args.includes('--skip-valid');
const startFromBatch = parseInt(args.find(arg => arg.startsWith('--start-from='))?.split('=')[1] || '0', 10);

fixMapCoordinates(forceRegeocode, startFromBatch).catch(console.error);

