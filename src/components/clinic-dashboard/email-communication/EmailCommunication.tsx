import { useState } from 'react';
import { Mail, FileText } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useHospitalPageContext } from '@/contexts/HospitalPageContext';
import { useEmailTemplates } from './hooks';
import EmailTemplates from './EmailTemplates';
import EmailPageCompose from '@/components/hospital/EmailPage';

export default function EmailCommunication() {
  const { hospitalPage } = useHospitalPageContext();
  const clinicId = hospitalPage?.id;

  const {
    templates,
    loading: templatesLoading,
    refetch: refetchTemplates,
  } = useEmailTemplates(clinicId);

  const [activeTab, setActiveTab] = useState('compose');

  if (!clinicId) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Email & Communication</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Compose emails and manage templates
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 max-w-xs">
          <TabsTrigger value="compose" className="gap-1.5 text-xs">
            <Mail className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Compose</span>
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-1.5 text-xs">
            <FileText className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Templates</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="compose" className="mt-6">
          <EmailPageCompose hideHeader templates={templates} />
        </TabsContent>

        <TabsContent value="templates" className="mt-6">
          <EmailTemplates
            clinicId={clinicId}
            templates={templates}
            loading={templatesLoading}
            onRefresh={refetchTemplates}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
