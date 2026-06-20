import { Link } from 'react-router-dom';
import { BarChart3, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function AdminStudentsTab() {
  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-5 w-5 text-primary" />
          Student Analytics
        </CardTitle>
        <CardDescription>
          Student growth data, cohort scripts, and promotion reports live in the dedicated analytics workspace.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild>
          <Link to="/analytics">
            Open Student Analytics
            <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
