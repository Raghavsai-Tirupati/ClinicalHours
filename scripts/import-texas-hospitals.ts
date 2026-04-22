import { parse } from 'csv-parse/sync';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration
const CSV_FILE_PATH = 'c:\\Users\\shiva\\Downloads\\texas (1).csv';
const BATCH_SIZE = 100; // Send 100 records per batch to edge function
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_URL:', SUPABASE_URL ? '✅' : '❌');
  console.error('   SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? '✅' : '❌');
  process.exit(1);
}

// Initialize Supabase client with anon key (for edge function calls)
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface CSVRow {
  name: string;
  website: string;
  email: string;
  phone: string;
  bio: string;
  city: string;
  state: string;
  lat: string;
  lon: string;
  source: string;
}

interface OpportunityInsert {
  name: string;
  type: 'hospital' | 'clinic' | 'hospice' | 'emt' | 'volunteer';
  location: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  hours_required: string;
  acceptance_likelihood: 'high' | 'medium' | 'low';
  phone: string | null;
  email: string | null;
  website: string | null;
  requirements: string[];
  description: string | null;
}

/**
 * Parse CSV file and return array of records
 */
function parseCSV(filePath: string): CSVRow[] {
  try {
    console.log(`📖 Reading CSV file: ${filePath}`);
    const fileContent = readFileSync(filePath, 'utf-8');
    
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as CSVRow[];
    
    console.log(`✅ Parsed ${records.length} records from CSV`);
    return records;
  } catch (error) {
    console.error('❌ Error reading CSV file:', error);
    throw error;
  }
}

/**
 * Map CSV row to opportunity insert format
 */
function mapCSVRowToOpportunity(row: CSVRow): OpportunityInsert | null {
  // Skip rows with missing required fields
  if (!row.name || !row.city) {
    return null;
  }

  // Build location string
  const location = row.state 
    ? `${row.city}, ${row.state}` 
    : row.city;

  // Parse coordinates
  const latitude = row.lat ? parseFloat(row.lat) : null;
  const longitude = row.lon ? parseFloat(row.lon) : null;

  // Validate coordinates
  if (latitude === null || longitude === null || isNaN(latitude) || isNaN(longitude)) {
    console.warn(`⚠️  Skipping ${row.name}: Invalid coordinates (lat: ${row.lat}, lon: ${row.lon})`);
    return null;
  }

  // Infer type from name/bio (default to hospital)
  let type: 'hospital' | 'clinic' | 'hospice' | 'emt' | 'volunteer' = 'hospital';
  const nameLower = row.name.toLowerCase();
  const bioLower = (row.bio || '').toLowerCase();
  
  if (nameLower.includes('clinic') || bioLower.includes('clinic')) {
    type = 'clinic';
  } else if (nameLower.includes('hospice') || bioLower.includes('hospice')) {
    type = 'hospice';
  } else if (nameLower.includes('emt') || nameLower.includes('emergency medical')) {
    type = 'emt';
  } else if (nameLower.includes('volunteer') || bioLower.includes('volunteer')) {
    type = 'volunteer';
  }

  // Clean phone number (remove spaces, keep + and digits)
  const phone = row.phone 
    ? row.phone.trim().replace(/\s+/g, '') || null
    : null;

  // Clean email
  const email = row.email && row.email.trim() ? row.email.trim() : null;

  // Clean website
  const website = row.website && row.website.trim() ? row.website.trim() : null;

  // Use bio as description
  const description = row.bio && row.bio.trim() ? row.bio.trim() : null;

  return {
    name: row.name.trim(),
    type,
    location,
    address: null, // Not in CSV
    latitude,
    longitude,
    hours_required: '4-8 hours/week', // Default
    acceptance_likelihood: 'medium', // Default
    phone,
    email,
    website,
    requirements: [], // Empty array, could parse from bio if needed
    description,
  };
}

/**
 * Send batch to edge function for processing
 */
async function sendBatchToEdgeFunction(opportunities: OpportunityInsert[]): Promise<{ success: number; failed: number; duplicates: number }> {
  if (opportunities.length === 0) {
    return { success: 0, failed: 0, duplicates: 0 };
  }

  try {
    const { data, error } = await supabase.functions.invoke('import-texas-hospitals', {
      body: { csvData: opportunities },
    });

    if (error) {
      console.error('❌ Edge function error:', error.message);
      return { success: 0, failed: opportunities.length, duplicates: 0 };
    }

    if (data?.error) {
      console.error('❌ Edge function returned error:', data.error);
      return { success: 0, failed: opportunities.length, duplicates: 0 };
    }

    return {
      success: data?.imported || 0,
      failed: opportunities.length - (data?.imported || 0),
      duplicates: data?.duplicates || 0,
    };
  } catch (error) {
    console.error('❌ Edge function exception:', error);
    return { success: 0, failed: opportunities.length, duplicates: 0 };
  }
}

/**
 * Main import function
 */
async function main() {
  console.log('🚀 Starting Texas Hospitals Import\n');
  console.log('=' .repeat(50));

  const startTime = Date.now();

  try {
    // Parse CSV
    const csvRows = parseCSV(CSV_FILE_PATH);
    
    if (csvRows.length === 0) {
      console.log('❌ No records found in CSV file');
      return;
    }

    // Map CSV rows to opportunities
    console.log('\n📝 Mapping CSV rows to opportunities...');
    const opportunities: OpportunityInsert[] = [];
    let skippedInvalid = 0;

    for (const row of csvRows) {
      const opportunity = mapCSVRowToOpportunity(row);
      if (!opportunity) {
        skippedInvalid++;
        continue;
      }

      opportunities.push(opportunity);
    }

    console.log(`✅ Mapped ${opportunities.length} valid opportunities`);
    console.log(`⚠️  Skipped ${skippedInvalid} invalid records`);

    if (opportunities.length === 0) {
      console.log('\n❌ No new opportunities to import');
      return;
    }

    // Process in batches
    console.log(`\n📦 Processing ${opportunities.length} opportunities in batches of ${BATCH_SIZE}...`);
    console.log('=' .repeat(50));

    let totalImported = 0;
    let totalFailed = 0;
    const totalBatches = Math.ceil(opportunities.length / BATCH_SIZE);

    for (let i = 0; i < opportunities.length; i += BATCH_SIZE) {
      const batch = opportunities.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const progress = ((i + batch.length) / opportunities.length * 100).toFixed(1);

      console.log(`\n📦 Batch ${batchNumber}/${totalBatches} (${i + 1}-${Math.min(i + batch.length, opportunities.length)} of ${opportunities.length}) [${progress}%]`);

      const result = await sendBatchToEdgeFunction(batch);
      totalImported += result.success;
      totalFailed += result.failed;
      skippedInvalid += result.duplicates;

      if (result.success > 0) {
        console.log(`   ✅ Imported ${result.success} opportunities`);
      }
      if (result.duplicates > 0) {
        console.log(`   ⚠️  Skipped ${result.duplicates} duplicates`);
      }
      if (result.failed > 0) {
        console.log(`   ❌ Failed to import ${result.failed} opportunities`);
      }

      // Small delay between batches to avoid overwhelming the database
      if (i + BATCH_SIZE < opportunities.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Final summary
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('\n' + '='.repeat(50));
    console.log('📊 IMPORT SUMMARY');
    console.log('='.repeat(50));
    console.log(`✅ Successfully imported: ${totalImported}`);
    console.log(`❌ Failed: ${totalFailed}`);
    console.log(`⚠️  Skipped (invalid/duplicate): ${skippedInvalid}`);
    console.log(`📝 Total processed: ${csvRows.length}`);
    console.log(`⏱️  Duration: ${duration}s`);
    console.log('='.repeat(50));

    if (totalImported > 0) {
      console.log('\n🎉 Import completed successfully!');
    } else {
      console.log('\n⚠️  No opportunities were imported');
    }

  } catch (error) {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  }
}

// Run the import
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

