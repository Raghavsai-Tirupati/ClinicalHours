import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CMSHospital {
  'Facility ID': string;
  'Facility Name': string;
  'Address': string;
  'City/Town': string;
  'State': string;
  'ZIP Code': string;
  'County/Parish': string;
  'Telephone Number': string;
  'Hospital Type': string;
  'Hospital Ownership': string;
  'Emergency Services': string;
  'Hospital overall rating': string;
}

interface GeocodeResult {
  latitude: number;
  longitude: number;
}

async function geocodeAddress(address: string, mapboxToken: string): Promise<GeocodeResult | null> {
  try {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${mapboxToken}&country=US&limit=1`;
    
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Geocoding failed for: ${address}`);
      return null;
    }
    
    const data = await response.json();
    if (data.features && data.features.length > 0) {
      const [longitude, latitude] = data.features[0].center;
      return { latitude, longitude };
    }
    return null;
  } catch (error) {
    console.error(`Geocoding error for ${address}:`, error);
    return null;
  }
}

function mapRatingToAcceptanceLikelihood(rating: string): 'high' | 'medium' | 'low' {
  const numRating = parseInt(rating);
  if (isNaN(numRating)) return 'medium';
  if (numRating >= 4) return 'high';
  if (numRating >= 3) return 'medium';
  return 'low';
}

function buildRequirements(hospital: CMSHospital): string[] {
  const requirements: string[] = [];
  
  if (hospital['Emergency Services'] === 'Yes') {
    requirements.push('Emergency services available');
  }
  
  if (hospital['Hospital overall rating'] && hospital['Hospital overall rating'] !== 'Not Available') {
    requirements.push(`CMS Rating: ${hospital['Hospital overall rating']}/5 stars`);
  }
  
  requirements.push('HIPAA compliance training required');
  requirements.push('Background check required');
  requirements.push('Minimum 18 years old');
  
  return requirements;
}

function buildDescription(hospital: CMSHospital): string {
  let desc = `${hospital['Facility Name']} is a ${hospital['Hospital Type'].toLowerCase()} located in ${hospital['City/Town']}, ${hospital['State']}.`;
  
  if (hospital['Hospital Ownership']) {
    desc += ` This ${hospital['Hospital Ownership'].toLowerCase()} facility`;
  }
  
  if (hospital['Emergency Services'] === 'Yes') {
    desc += ' offers emergency services.';
  } else {
    desc += ' provides healthcare services to the community.';
  }
  
  if (hospital['Hospital overall rating'] && hospital['Hospital overall rating'] !== 'Not Available') {
    desc += ` The facility has a CMS overall rating of ${hospital['Hospital overall rating']} out of 5 stars.`;
  }
  
  return desc;
}

// Parse CSV string into array of objects
function parseCSV(csvText: string): CMSHospital[] {
  const lines = csvText.split('\n');
  if (lines.length < 2) return [];
  
  // Parse header line - handle quoted fields
  const headerLine = lines[0];
  const headers: string[] = [];
  let inQuotes = false;
  let currentField = '';
  
  for (let i = 0; i < headerLine.length; i++) {
    const char = headerLine[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      headers.push(currentField.trim());
      currentField = '';
    } else {
      currentField += char;
    }
  }
  headers.push(currentField.trim());
  
  console.log(`CSV Headers: ${headers.slice(0, 10).join(', ')}...`);
  
  const hospitals: CMSHospital[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values: string[] = [];
    inQuotes = false;
    currentField = '';
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(currentField.trim());
        currentField = '';
      } else {
        currentField += char;
      }
    }
    values.push(currentField.trim());
    
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length && j < values.length; j++) {
      row[headers[j]] = values[j];
    }
    
    if (row['Facility ID'] && row['Facility Name']) {
      hospitals.push(row as unknown as CMSHospital);
    }
  }
  
  return hospitals;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { limit = 100, state = null, offset = 0 } = await req.json();
    
    console.log(`Starting hospital import: limit=${limit}, state=${state}, offset=${offset}`);
    
    const mapboxToken = Deno.env.get('MAPBOX_PUBLIC_TOKEN');
    if (!mapboxToken) {
      throw new Error('MAPBOX_PUBLIC_TOKEN not configured');
    }
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Download CSV directly from CMS
    const csvUrl = 'https://data.cms.gov/provider-data/sites/default/files/resources/893c372430d9d71a1c52737d01239d47_1760630721/Hospital_General_Information.csv';
    
    console.log(`Fetching CSV from CMS: ${csvUrl}`);
    
    const csvResponse = await fetch(csvUrl);
    if (!csvResponse.ok) {
      throw new Error(`CMS CSV download error: ${csvResponse.status}`);
    }
    
    const csvText = await csvResponse.text();
    console.log(`Downloaded CSV, size: ${csvText.length} bytes`);
    
    let hospitals = parseCSV(csvText);
    console.log(`Parsed ${hospitals.length} hospitals from CSV`);
    
    // Filter by state if specified
    if (state) {
      hospitals = hospitals.filter(h => h['State'] === state);
      console.log(`Filtered to ${hospitals.length} hospitals in ${state}`);
    }
    
    // Apply offset and limit
    hospitals = hospitals.slice(offset, offset + limit);
    console.log(`Processing ${hospitals.length} hospitals (offset=${offset}, limit=${limit})`);
    
    if (hospitals.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        imported: 0, 
        skipped: 0,
        message: 'No hospitals found matching criteria' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Get existing facility names to avoid duplicates
    const { data: existingOpps } = await supabase
      .from('opportunities')
      .select('name')
      .eq('type', 'hospital');
    
    const existingNames = new Set(existingOpps?.map(o => o.name) || []);
    console.log(`Found ${existingNames.size} existing hospitals in database`);
    
    let imported = 0;
    let skipped = 0;
    let failed = 0;
    const batchSize = 10;
    
    for (let i = 0; i < hospitals.length; i += batchSize) {
      const batch = hospitals.slice(i, i + batchSize);
      
      const insertPromises = batch.map(async (hospital) => {
        // Skip if already exists
        if (existingNames.has(hospital['Facility Name'])) {
          skipped++;
          return null;
        }
        
        const fullAddress = `${hospital['Address']}, ${hospital['City/Town']}, ${hospital['State']} ${hospital['ZIP Code']}`;
        
        // Geocode the address
        const coords = await geocodeAddress(fullAddress, mapboxToken);
        if (!coords) {
          console.log(`Failed to geocode: ${fullAddress}`);
          failed++;
          return null;
        }
        
        const opportunity = {
          name: hospital['Facility Name'],
          type: 'hospital' as const,
          location: `${hospital['City/Town']}, ${hospital['State']}`,
          address: fullAddress,
          latitude: coords.latitude,
          longitude: coords.longitude,
          phone: hospital['Telephone Number'] || null,
          email: null,
          website: null,
          hours_required: '4-8 hours/week',
          acceptance_likelihood: mapRatingToAcceptanceLikelihood(hospital['Hospital overall rating']),
          requirements: buildRequirements(hospital),
          description: buildDescription(hospital),
        };
        
        return opportunity;
      });
      
      const results = await Promise.all(insertPromises);
      const validOpportunities = results.filter(o => o !== null);
      
      if (validOpportunities.length > 0) {
        const { error } = await supabase
          .from('opportunities')
          .insert(validOpportunities);
        
        if (error) {
          console.error('Insert error:', error);
          failed += validOpportunities.length;
        } else {
          imported += validOpportunities.length;
        }
      }
      
      // Small delay between batches to respect rate limits
      if (i + batchSize < hospitals.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      console.log(`Progress: processed ${i + batch.length}/${hospitals.length}, imported=${imported}`);
    }
    
    console.log(`Import complete: imported=${imported}, skipped=${skipped}, failed=${failed}`);
    
    return new Response(JSON.stringify({ 
      success: true, 
      imported, 
      skipped,
      failed,
      total: hospitals.length,
      message: `Successfully imported ${imported} hospitals` 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('Import error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
