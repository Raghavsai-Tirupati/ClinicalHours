import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useHospitalPageContext } from '@/contexts/HospitalPageContext';

export default function HospitalSettings() {
  const { hospitalPage } = useHospitalPageContext();

  if (!hospitalPage) return null;

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="text-2xl font-bold">Settings</h2>

      <Card>
        <CardHeader>
          <CardTitle>Hospital Information</CardTitle>
          <CardDescription>Details pulled from your listing</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Name</p>
              <p className="font-medium">{hospitalPage.opportunity.name}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Location</p>
              <p className="font-medium">{hospitalPage.opportunity.location}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Type</p>
              <Badge variant="outline">{hospitalPage.opportunity.type}</Badge>
            </div>
            {hospitalPage.opportunity.website && (
              <div>
                <p className="text-muted-foreground">Website</p>
                <a
                  href={hospitalPage.opportunity.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline text-sm"
                >
                  {hospitalPage.opportunity.website}
                </a>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Admin Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="text-muted-foreground">Admin Email</p>
            <p className="font-medium">{hospitalPage.admin_email}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Status</p>
            <Badge variant={hospitalPage.is_claimed ? 'default' : 'outline'}>
              {hospitalPage.is_claimed ? 'Claimed' : 'Unclaimed'}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
