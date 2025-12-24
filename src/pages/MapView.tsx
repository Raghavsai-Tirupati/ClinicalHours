import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import OpportunityMap from "@/components/OpportunityMap";

const MapView = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
        
        <main className="flex-1 container mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2 text-foreground">Opportunity Map</h1>
            <p className="text-muted-foreground">
              Explore clinical opportunities across the country. Switch between viewing all opportunities or just your saved ones.
            </p>
          </div>

          <OpportunityMap />

          <div className="mt-8 grid md:grid-cols-3 gap-6">
            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="font-semibold text-foreground mb-2">🏥 Find Nearby</h3>
              <p className="text-sm text-muted-foreground">
                Allow location access to see opportunities closest to you. The map will show your current location with a blue marker.
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="font-semibold text-foreground mb-2">📍 Click for Details</h3>
              <p className="text-sm text-muted-foreground">
                Click on any marker to see detailed information about the opportunity including hours required and acceptance likelihood.
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="font-semibold text-foreground mb-2">⭐ Track Your Saved</h3>
              <p className="text-sm text-muted-foreground">
                Switch to "My Saved" mode to view only the opportunities you've added to your dashboard tracker.
              </p>
            </div>
          </div>
        </main>

        <Footer />
      </div>
  );
};

export default MapView;
