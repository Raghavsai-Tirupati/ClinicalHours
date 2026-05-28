import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, MapPin, X } from "lucide-react";
import type { HospitalOption } from "./types";

export type { HospitalOption };

interface HospitalSignupSearchProps {
  hospitalSearchQuery: string;
  onSearchQueryChange: (value: string) => void;
  hospitalSearchResults: HospitalOption[];
  hospitalSearchLoading: boolean;
  showSearchResults: boolean;
  onShowSearchResults: (show: boolean) => void;
  selectedOpportunity: HospitalOption | null;
  debouncedHospitalSearch: string;
  onSelect: (hospital: HospitalOption) => void;
  onClear: () => void;
  disabled: boolean;
}

const HospitalSignupSearch = ({
  hospitalSearchQuery,
  onSearchQueryChange,
  hospitalSearchResults,
  hospitalSearchLoading,
  showSearchResults,
  onShowSearchResults,
  selectedOpportunity,
  debouncedHospitalSearch,
  onSelect,
  onClear,
  disabled,
}: HospitalSignupSearchProps) => {
  return (
    <div className="space-y-3 p-3 bg-muted/20 rounded-lg border border-border/30">
      <div className="space-y-2">
        <Label htmlFor="hospital-search">Hospital / Facility Name</Label>
        {selectedOpportunity ? (
          <div className="flex items-center gap-2 p-2.5 bg-background rounded-md border border-border">
            <div className="flex-1 min-w-0">
              <p className="break-words text-sm font-medium">{selectedOpportunity.name}</p>
              <p className="flex items-start gap-1 break-words text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0" />
                {selectedOpportunity.location}
              </p>
            </div>
            <Badge variant="secondary" className="text-xs shrink-0">{selectedOpportunity.type}</Badge>
            <button
              type="button"
              onClick={onClear}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="hospital-search"
              type="text"
              placeholder="Search for your hospital or clinic..."
              value={hospitalSearchQuery}
              onChange={(e) => {
                onSearchQueryChange(e.target.value);
                onShowSearchResults(true);
              }}
              onFocus={() => {
                if (hospitalSearchResults.length > 0) onShowSearchResults(true);
              }}
              disabled={disabled}
              className="h-10 pl-9"
              autoComplete="off"
            />
            {hospitalSearchLoading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
            {/* Search results dropdown */}
            {showSearchResults && hospitalSearchResults.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                {hospitalSearchResults.map((opp) => (
                  <button
                    key={opp.id}
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-muted transition-colors border-b border-border/30 last:border-0"
                    onClick={() => onSelect(opp)}
                  >
                    <p className="break-words text-sm font-medium">{opp.name}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      <span className="flex min-w-0 flex-1 items-start gap-1 break-words text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {opp.location}
                      </span>
                      <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">{opp.type}</Badge>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {showSearchResults && debouncedHospitalSearch.trim() && !hospitalSearchLoading && hospitalSearchResults.length === 0 && (
              <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg p-3">
                <p className="text-sm text-muted-foreground text-center">No results found</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default HospitalSignupSearch;
