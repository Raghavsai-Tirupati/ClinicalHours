import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Briefcase, GraduationCap, Award, Activity } from "lucide-react";

const Resume = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-12">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-2">Resume</h1>
              <p className="text-lg text-muted-foreground">Pre-Medical Student & Healthcare Advocate</p>
            </div>
            <Button className="w-full md:w-auto">
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
          </div>

          {/* Education */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-primary" />
                <CardTitle>Education</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Bachelor of Science in Biology</h3>
                <p className="text-muted-foreground">University of California | 2020 - 2024</p>
                <p className="text-sm mt-2">GPA: 3.9/4.0 | Dean's List: All Semesters</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Badge>Pre-Medical Track</Badge>
                  <Badge>Biochemistry Minor</Badge>
                  <Badge>Honors Program</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Clinical Experience */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                <CardTitle>Clinical Experience</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold">Emergency Department Volunteer</h3>
                <p className="text-muted-foreground">City General Hospital | 2022 - Present</p>
                <ul className="list-disc list-inside text-sm space-y-1 mt-2 text-muted-foreground">
                  <li>Logged 200+ hours assisting medical staff in fast-paced ER environment</li>
                  <li>Provided patient support and comfort during emergency procedures</li>
                  <li>Shadowed physicians and learned triage protocols</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold">Medical Scribe</h3>
                <p className="text-muted-foreground">Community Health Clinic | 2021 - 2022</p>
                <ul className="list-disc list-inside text-sm space-y-1 mt-2 text-muted-foreground">
                  <li>Documented patient encounters for 5+ physicians across multiple specialties</li>
                  <li>Maintained detailed medical records in EMR systems</li>
                  <li>Gained exposure to diverse patient populations and medical conditions</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold">Hospice Volunteer</h3>
                <p className="text-muted-foreground">Sunrise Hospice Care | 2021</p>
                <ul className="list-disc list-inside text-sm space-y-1 mt-2 text-muted-foreground">
                  <li>Provided compassionate end-of-life care and emotional support to patients</li>
                  <li>Assisted families during difficult transitions</li>
                  <li>Completed 60+ hours of palliative care experience</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Leadership & Activities */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-primary" />
                <CardTitle>Leadership & Activities</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Founder & President</h3>
                <p className="text-muted-foreground">ClinicalHours Platform | 2023 - Present</p>
                <ul className="list-disc list-inside text-sm space-y-1 mt-2 text-muted-foreground">
                  <li>Created crowdsourced platform connecting 500+ pre-med students with clinical opportunities</li>
                  <li>Built and managed team of 5 student volunteers</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold">Research Assistant</h3>
                <p className="text-muted-foreground">Biomedical Research Lab | 2022 - Present</p>
                <ul className="list-disc list-inside text-sm space-y-1 mt-2 text-muted-foreground">
                  <li>Conducted research on cardiovascular disease mechanisms</li>
                  <li>Co-authored publication in undergraduate research journal</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Skills & Certifications */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-primary" />
                <CardTitle>Skills & Certifications</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Certifications</h4>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">CPR/AED Certified</Badge>
                    <Badge variant="secondary">HIPAA Trained</Badge>
                    <Badge variant="secondary">Basic Life Support (BLS)</Badge>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Skills</h4>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">Patient Care</Badge>
                    <Badge variant="outline">Medical Terminology</Badge>
                    <Badge variant="outline">EMR Systems</Badge>
                    <Badge variant="outline">Spanish (Conversational)</Badge>
                    <Badge variant="outline">Research Methods</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Resume;
