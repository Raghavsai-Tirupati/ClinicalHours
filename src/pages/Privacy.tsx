import { Helmet } from "react-helmet-async";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

const Privacy = () => {
  return (
    <>
      <Helmet>
        <title>Privacy Policy | ClinicalHours</title>
        <meta name="description" content="Learn how ClinicalHours collects, uses, stores, and safeguards your personal information." />
        <link rel="canonical" href="https://clinicalhours.lovable.app/privacy" />
        <meta property="og:title" content="Privacy Policy | ClinicalHours" />
        <meta property="og:description" content="Learn how ClinicalHours collects, uses, stores, and safeguards your personal information." />
        <meta property="og:url" content="https://clinicalhours.lovable.app/privacy" />
        <meta property="og:type" content="website" />
      </Helmet>
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="container mx-auto px-4 pt-28 pb-12 max-w-4xl">
          <h1 className="text-4xl font-bold mb-2 scroll-mt-28">Privacy Policy</h1>
          <p className="text-muted-foreground mb-8">Last Updated: December 26, 2025</p>

          <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
            <section>
              <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
              <p className="text-muted-foreground leading-relaxed">
                <span>Clinical</span><span className="font-semibold">Hours</span> ("<span>Clinical</span><span className="font-semibold">Hours</span>," "we," "our," or "us") values your privacy and is committed to protecting your personal data. This Privacy Policy explains how we collect, use, store, and safeguard your information when you access our website at clinicalhours.com, use our mobile or web applications, or otherwise interact with our services (collectively, the "Platform").
              </p>
              <p className="text-muted-foreground leading-relaxed mt-4">
                By accessing or using the Platform, you agree to this Privacy Policy. If you do not agree, please discontinue use of the Platform.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">2. Information We Collect</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                We collect personal and usage information in the following categories:
              </p>
              
              <h3 className="text-xl font-medium mb-2">2.1 Account Information</h3>
              <p className="text-muted-foreground leading-relaxed mb-2">When you create an account, we collect:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Full name</li>
                <li>Email address</li>
                <li>Password (stored in encrypted form)</li>
                <li>Optional profile details such as school name, graduation year, avatar, or major</li>
              </ul>

              <h3 className="text-xl font-medium mb-2 mt-4">2.2 Activity Data</h3>
              <p className="text-muted-foreground leading-relaxed mb-2">We collect data related to your interactions on the Platform, including:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Saved and viewed opportunities</li>
                <li>Submitted reviews, ratings, questions, and answers</li>
                <li>Votes and other in-app actions</li>
              </ul>

              <h3 className="text-xl font-medium mb-2 mt-4">2.3 Location Data</h3>
              <p className="text-muted-foreground leading-relaxed">
                If you enable location-based search, we may collect approximate geographic data (city, state, coordinates) to show opportunities near you. You can disable location sharing at any time through your device or browser settings.
              </p>

              <h3 className="text-xl font-medium mb-2 mt-4">2.4 Files and Uploads</h3>
              <p className="text-muted-foreground leading-relaxed">
                If you choose to upload files (such as resumes or documents), they are stored securely and accessible only to you and authorized systems performing service functions.
              </p>

              <h3 className="text-xl font-medium mb-2 mt-4">2.5 Automatically Collected Data</h3>
              <p className="text-muted-foreground leading-relaxed mb-2">We automatically collect technical data when you use the Platform, including:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>IP address and device identifiers</li>
                <li>Browser type, operating system, and access times</li>
                <li>Pages viewed, navigation paths, and interactions</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-2">
                This helps us maintain system security, analyze usage patterns, and improve performance.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">3. How We Use Your Information</h2>
              <p className="text-muted-foreground leading-relaxed mb-2">We use collected data to:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Operate and maintain the Platform</li>
                <li>Provide personalized features and recommendations</li>
                <li>Facilitate user-generated content such as reviews or questions</li>
                <li>Communicate updates, reminders, or important service notices</li>
                <li>Ensure compliance with our Terms and prevent misuse or fraud</li>
                <li>Analyze trends and improve the user experience</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4 font-medium">
                We do not sell or rent personal data to third parties.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">4. Legal Basis for Processing</h2>
              <p className="text-muted-foreground leading-relaxed mb-2">
                If you are located in a jurisdiction that requires a legal basis for processing personal data, we rely on the following grounds:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li><strong>Consent:</strong> When you voluntarily provide information or enable optional features.</li>
                <li><strong>Contractual necessity:</strong> To deliver the services you request.</li>
                <li><strong>Legitimate interests:</strong> To maintain platform integrity, improve features, and prevent abuse.</li>
                <li><strong>Legal obligation:</strong> To comply with applicable laws and regulations.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">5. Data Sharing and Disclosure</h2>
              <p className="text-muted-foreground leading-relaxed mb-2">
                We share information only when necessary for legitimate operational reasons:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li><strong>Service providers:</strong> We use trusted third-party vendors for hosting, email delivery, mapping, and analytics. These parties are bound by confidentiality and data protection obligations.</li>
                <li><strong>Legal compliance:</strong> We may disclose data when required by law, legal process, or law enforcement authorities.</li>
                <li><strong>Business changes:</strong> If <span>Clinical</span><span className="font-semibold">Hours</span> is involved in a merger, acquisition, or asset sale, your data may be transferred under appropriate safeguards.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">6. Data Security</h2>
              <p className="text-muted-foreground leading-relaxed mb-2">
                We implement industry-standard safeguards to protect user data, including:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Encrypted HTTPS connections for all transmissions</li>
                <li>Secure password hashing (e.g., bcrypt or similar)</li>
                <li>Database access controls and row-level security</li>
                <li>Regular monitoring for vulnerabilities and threats</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                Despite these measures, no online service can guarantee complete security. You share information at your own risk.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">7. Data Retention</h2>
              <p className="text-muted-foreground leading-relaxed">
                We retain personal information only as long as necessary to fulfill the purposes described in this policy, comply with legal obligations, or resolve disputes. You may delete your account at any time, which triggers permanent removal of your personal data from active systems within a reasonable period.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">8. Your Rights and Choices</h2>
              <p className="text-muted-foreground leading-relaxed mb-2">
                Depending on your jurisdiction, you may have the right to:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Access, correct, or delete your personal data</li>
                <li>Withdraw consent for processing (where applicable)</li>
                <li>Request a copy of your data in a portable format</li>
                <li>Opt out of promotional communications</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                You can manage most preferences directly through your account settings or by contacting us at support@clinicalhours.org.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">9. Children's Privacy</h2>
              <p className="text-muted-foreground leading-relaxed">
                The Platform is not directed toward children under 13. If we learn that we have collected personal information from a child under 13 without verifiable parental consent, we will promptly delete it.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">10. International Data Transfers</h2>
              <p className="text-muted-foreground leading-relaxed">
                <span>Clinical</span><span className="font-semibold">Hours</span> is operated in the United States. If you access the Platform from outside the U.S., you acknowledge that your information may be processed and stored in the U.S., where privacy laws may differ from those in your jurisdiction.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">11. Changes to This Policy</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may update this Privacy Policy from time to time to reflect operational, legal, or regulatory changes. Updated versions will be posted on this page with a revised "Last Updated" date. We encourage you to review this Policy periodically.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">12. Contact Us</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have any questions or concerns about this Privacy Policy or our data practices, please contact us at:
              </p>
              <p className="text-muted-foreground mt-2">
                <strong>Email:</strong>{" "}
                <a href="mailto:support@clinicalhours.org" className="text-primary hover:underline">
                  support@clinicalhours.org
                </a>
              </p>
            </section>
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
};

export default Privacy;
