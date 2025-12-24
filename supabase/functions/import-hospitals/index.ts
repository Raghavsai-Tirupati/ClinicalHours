import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CMSHospital {
  facility_id: string;
  facility_name: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  county_name: string;
  phone_number: string;
  hospital_type: string;
  hospital_ownership: string;
  emergency_services: string;
  hospital_overall_rating: string;
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
  
  if (hospital.emergency_services === 'Yes') {
    requirements.push('Emergency services available');
  }
  
  if (hospital.hospital_overall_rating && hospital.hospital_overall_rating !== 'Not Available') {
    requirements.push(`CMS Rating: ${hospital.hospital_overall_rating}/5 stars`);
  }
  
  requirements.push('HIPAA compliance training required');
  requirements.push('Background check required');
  requirements.push('Minimum 18 years old');
  
  return requirements;
}

function buildDescription(hospital: CMSHospital): string {
  let desc = `${hospital.facility_name} is a ${hospital.hospital_type.toLowerCase()} located in ${hospital.city}, ${hospital.state}.`;
  
  if (hospital.hospital_ownership) {
    desc += ` This ${hospital.hospital_ownership.toLowerCase()} facility`;
  }
  
  if (hospital.emergency_services === 'Yes') {
    desc += ' offers emergency services.';
  } else {
    desc += ' provides healthcare services to the community.';
  }
  
  if (hospital.hospital_overall_rating && hospital.hospital_overall_rating !== 'Not Available') {
    desc += ` The facility has a CMS overall rating of ${hospital.hospital_overall_rating} out of 5 stars.`;
  }
  
  return desc;
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
    
    // Build CMS API URL with filters
    let cmsUrl = `https://data.cms.gov/data-api/v1/dataset/xubh-q36u/data?size=${limit}&offset=${offset}`;
    if (state) {
      cmsUrl += `&filter[state]=${state}`;
    }
    
    console.log(`Fetching from CMS API: ${cmsUrl}`);
    
    const cmsResponse = await fetch(cmsUrl);
    if (!cmsResponse.ok) {
      throw new Error(`CMS API error: ${cmsResponse.status}`);
    }
    
    const hospitals: CMSHospital[] = await cmsResponse.json();
    console.log(`Fetched ${hospitals.length} hospitals from CMS`);
    
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
    
    // Get existing facility IDs to avoid duplicates
    const facilityIds = hospitals.map(h => h.facility_id);
    const { data: existingOpps } = await supabase
      .from('opportunities')
      .select('name, address')
      .in('name', hospitals.map(h => h.facility_name));
    
    const existingNames = new Set(existingOpps?.map(o => o.name) || []);
    
    let imported = 0;
    let skipped = 0;
    let failed = 0;
    const batchSize = 10; // Process 10 at a time to avoid rate limits
    
    for (let i = 0; i < hospitals.length; i += batchSize) {
      const batch = hospitals.slice(i, i + batchSize);
      
      const insertPromises = batch.map(async (hospital) => {
        // Skip if already exists
        if (existingNames.has(hospital.facility_name)) {
          skipped++;
          return null;
        }
        
        const fullAddress = `${hospital.address}, ${hospital.city}, ${hospital.state} ${hospital.zip_code}`;
        
        // Geocode the address
        const coords = await geocodeAddress(fullAddress, mapboxToken);
        if (!coords) {
          console.log(`Failed to geocode: ${fullAddress}`);
          failed++;
          return null;
        }
        
        const opportunity = {
          name: hospital.facility_name,
          type: 'hospital' as const,
          location: `${hospital.city}, ${hospital.state}`,
          address: fullAddress,
          latitude: coords.latitude,
          longitude: coords.longitude,
          phone: hospital.phone_number || null,
          email: null,
          website: null,
          hours_required: '4-8 hours/week',
          acceptance_likelihood: mapRatingToAcceptanceLikelihood(hospital.hospital_overall_rating),
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
