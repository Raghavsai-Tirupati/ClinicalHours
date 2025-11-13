import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";

const Projects = () => {
  const projects = [
    {
      title: "Medical Outreach Initiative",
      description:
        "Organized free health screenings and wellness workshops in underserved communities, serving 500+ individuals.",
      impact: "500+ people served",
      year: "2023",
      tags: ["Community Health", "Nonprofit"],
    },
    {
      title: "Student Health Education Program",
      description:
        "Developed curriculum and led workshops on nutrition, mental health, and preventive care for high school students.",
      impact: "200+ students educated",
      year: "2023",
      tags: ["Education", "Youth Outreach"],
    },
    {
      title: "COVID-19 Vaccination Drive",
      description:
        "Coordinated with local health departments to organize vaccination clinics in rural areas with limited healthcare access.",
      impact: "1,000+ vaccines administered",
      year: "2022",
      tags: ["Public Health", "Community Service"],
    },
    {
      title: "Healthcare Access Research",
      description:
        "Conducted research on barriers to healthcare access in low-income neighborhoods and presented findings to local policymakers.",
      impact: "Published in undergraduate journal",
      year: "2022",
      tags: ["Research", "Health Policy"],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Projects & Nonprofit Work</h1>
            <p className="text-lg text-muted-foreground">
              A collection of community health initiatives and nonprofit projects dedicated to improving healthcare
              access and education.
            </p>
          </div>

          {/* Projects List */}
          <div className="space-y-6">
            {projects.map((project, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <CardTitle className="text-2xl mb-2">{project.title}</CardTitle>
                      <CardDescription className="text-base">{project.description}</CardDescription>
                    </div>
                    <Badge variant="secondary">{project.year}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Impact:</span>
                      <span className="text-sm text-primary font-semibold">{project.impact}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {project.tags.map((tag, tagIndex) => (
                        <Badge key={tagIndex} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Call to Action */}
          <Card className="mt-12 bg-primary text-primary-foreground">
            <CardContent className="pt-6 text-center space-y-4">
              <h2 className="text-2xl font-bold">Want to Collaborate?</h2>
              <p className="opacity-90">
                I'm always looking for opportunities to contribute to meaningful healthcare initiatives. If you have a
                project or nonprofit work that could benefit from my experience, let's connect.
              </p>
              <a
                href="/contact"
                className="inline-flex items-center gap-2 text-primary-foreground hover:opacity-80 transition-opacity font-medium"
              >
                Get in Touch <ExternalLink className="h-4 w-4" />
              </a>
            </CardContent>
          </Card>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Projects;
