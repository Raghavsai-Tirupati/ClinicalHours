import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Heart, Users, Target, Award } from "lucide-react";
import communityImage from "@/assets/community-illustration.png";

const About = () => {
  const values = [
    {
      icon: Heart,
      title: "Student-Focused",
      description: "Built by students, for students. We understand the challenges of finding clinical opportunities.",
    },
    {
      icon: Users,
      title: "Community-Driven",
      description: "Powered by honest reviews and experiences from real pre-med students nationwide.",
    },
    {
      icon: Target,
      title: "Transparent",
      description: "Clear information about requirements, hours, and acceptance rates—no surprises.",
    },
    {
      icon: Award,
      title: "Comprehensive",
      description: "From hospitals to EMT programs, we cover all types of clinical opportunities.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">About ClinicalHours</h1>
            <p className="text-lg text-muted-foreground">
              Empowering the next generation of healthcare professionals through accessible clinical opportunities.
            </p>
          </div>

          {/* Mission Section */}
          <section className="mb-16">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-2xl font-bold mb-4">Our Mission</h2>
                <p className="text-muted-foreground leading-relaxed">
                  ClinicalHours was created to solve a critical challenge faced by pre-med students: finding quality
                  clinical experiences. We recognized that the process was often opaque, time-consuming, and stressful.
                  Students spent countless hours researching, calling, and emailing various facilities without clear
                  guidance on requirements or acceptance rates.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Our platform brings transparency and efficiency to this process by crowdsourcing information from
                  students who have successfully secured clinical positions. Whether you're looking for shadowing hours
                  at a hospital, volunteering at a clinic, or joining an EMT program, we provide the insights you need
                  to make informed decisions and maximize your chances of acceptance.
                </p>
              </CardContent>
            </Card>
          </section>

          {/* Values Section */}
          <section className="mb-16">
            <h2 className="text-3xl font-bold text-center mb-12">Our Values</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {values.map((value, index) => (
                <Card key={index} className="border-border">
                  <CardContent className="pt-6">
                    <value.icon className="h-10 w-10 text-primary mb-4" />
                    <h3 className="text-xl font-semibold mb-2">{value.title}</h3>
                    <p className="text-muted-foreground">{value.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* Story Section */}
          <section className="mb-16">
            <Card className="bg-secondary/30 overflow-hidden">
              <div className="flex flex-col md:flex-row">
                <div className="md:w-1/3 p-6 flex items-center justify-center">
                  <img src={communityImage} alt="" className="w-full max-w-xs rounded-lg opacity-80" />
                </div>
                <CardContent className="md:w-2/3 pt-6 space-y-4">
                <h2 className="text-2xl font-bold mb-4">How It Started</h2>
                <p className="text-muted-foreground leading-relaxed">
                  As pre-med students ourselves, we experienced firsthand the frustration of trying to find clinical
                  opportunities. We spent weeks calling different facilities, only to discover that many didn't accept
                  volunteers, had extremely limited spots, or required certifications we didn't have.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  We realized that there had to be a better way. By creating a centralized platform where students could
                  share their experiences and insights, we could help future pre-meds navigate this process more
                  efficiently. Today, ClinicalHours serves hundreds of students across the country, helping them find
                  the perfect clinical opportunities to strengthen their medical school applications.
                </p>
                </CardContent>
              </div>
            </Card>
          </section>

          {/* Impact Section */}
          <section className="text-center">
            <h2 className="text-3xl font-bold mb-6">Our Impact</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
              <div>
                <div className="text-4xl font-bold text-primary mb-2">500+</div>
                <div className="text-sm text-muted-foreground">Opportunities Listed</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-primary mb-2">1,000+</div>
                <div className="text-sm text-muted-foreground">Student Reviews</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-primary mb-2">50+</div>
                <div className="text-sm text-muted-foreground">Cities Covered</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-primary mb-2">95%</div>
                <div className="text-sm text-muted-foreground">Success Rate</div>
              </div>
            </div>
          </section>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default About;
