import { Helmet } from "react-helmet-async";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

const Terms = () => {
  return (
    <>
      <Helmet>
        <title>Terms and Conditions | ClinicalHours</title>
        <meta name="description" content="Terms and Conditions for using ClinicalHours - the platform connecting pre-med students with clinical experience opportunities." />
      </Helmet>
      
      <div className="min-h-screen bg-background">
        <Navigation />
        
        <main className="container mx-auto px-4 py-12 max-w-4xl">
          <h1 className="text-4xl font-bold mb-2">Terms and Conditions</h1>
          <p className="text-muted-foreground mb-8">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          
          <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
            {/* Introduction */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
              <p className="text-muted-foreground leading-relaxed">
                Welcome to ClinicalHours ("we," "our," or "us"). By accessing or using our website at clinicalhours.com and related services (the "Platform"), you agree to be bound by these Terms and Conditions. If you do not agree to these terms, please do not use our Platform.
              </p>
              <p className="text-muted-foreground leading-relaxed mt-4">
                ClinicalHours is a free platform designed to help pre-medical students discover and track clinical experience opportunities across the United States.
              </p>
            </section>

            {/* User Responsibilities */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">2. User Responsibilities</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                By using ClinicalHours, you agree to:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Provide accurate and truthful information when creating an account and submitting content</li>
                <li>Maintain the confidentiality of your account credentials</li>
                <li>Use the Platform only for lawful purposes related to finding clinical opportunities</li>
                <li>Not impersonate any person or entity or misrepresent your affiliation</li>
                <li>Not attempt to gain unauthorized access to any part of the Platform</li>
                <li>Not use automated systems or bots to access the Platform without permission</li>
                <li>Verify all opportunity details directly with the healthcare facility before applying</li>
                <li>Comply with all applicable laws and regulations</li>
              </ul>
            </section>

            {/* Account Registration */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">3. Account Registration</h2>
              <p className="text-muted-foreground leading-relaxed">
                To access certain features of the Platform, you must create an account. You are responsible for maintaining the security of your account and for all activities that occur under your account. You must be at least 13 years old to create an account. If you are under 18, you represent that you have parental or guardian consent to use the Platform.
              </p>
            </section>

            {/* Content Policies */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">4. Content Policies</h2>
              
              <h3 className="text-xl font-medium mb-3 mt-6">4.1 User-Generated Content</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Users may submit reviews, questions, answers, and other content ("User Content"). By submitting User Content, you grant ClinicalHours a non-exclusive, worldwide, royalty-free license to use, display, and distribute such content on the Platform.
              </p>
              
              <h3 className="text-xl font-medium mb-3">4.2 Prohibited Content</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                You agree not to post content that:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Is false, misleading, or fraudulent</li>
                <li>Violates the privacy rights of others</li>
                <li>Contains personal health information (PHI) or violates HIPAA</li>
                <li>Is defamatory, harassing, threatening, or discriminatory</li>
                <li>Infringes on intellectual property rights</li>
                <li>Contains spam, advertisements, or promotional material</li>
                <li>Includes malicious code or links to harmful websites</li>
              </ul>
              
              <h3 className="text-xl font-medium mb-3 mt-6">4.3 Content Moderation</h3>
              <p className="text-muted-foreground leading-relaxed">
                We reserve the right to remove any User Content that violates these terms or that we deem inappropriate at our sole discretion. Repeated violations may result in account suspension or termination.
              </p>
            </section>

            {/* Data Privacy */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">5. Data Privacy</h2>
              
              <h3 className="text-xl font-medium mb-3 mt-6">5.1 Information We Collect</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                We collect the following types of information:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li><strong>Account Information:</strong> Email address, full name, and optional profile details (graduation year, school, avatar)</li>
                <li><strong>Activity Data:</strong> Saved opportunities, reviews, questions, answers, and votes</li>
                <li><strong>Location Data:</strong> City, state, and coordinates (when you enable location-based search)</li>
                <li><strong>Files:</strong> Resume uploads stored securely in our system</li>
              </ul>
              
              <h3 className="text-xl font-medium mb-3 mt-6">5.2 How We Use Your Data</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Your data is used to:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Provide and improve our services</li>
                <li>Personalize your experience and show relevant opportunities</li>
                <li>Send reminder notifications (when enabled by you)</li>
                <li>Communicate important updates about the Platform</li>
                <li>Ensure platform security and prevent abuse</li>
              </ul>
              
              <h3 className="text-xl font-medium mb-3 mt-6">5.3 Data Security</h3>
              <p className="text-muted-foreground leading-relaxed">
                We implement industry-standard security measures including encrypted connections (HTTPS), secure password hashing, and row-level security policies to protect your data. However, no method of transmission over the Internet is 100% secure.
              </p>
              
              <h3 className="text-xl font-medium mb-3 mt-6">5.4 Third-Party Services</h3>
              <p className="text-muted-foreground leading-relaxed">
                We use third-party services to operate the Platform, including cloud hosting, mapping services, and email delivery. These services may process your data in accordance with their own privacy policies.
              </p>
            </section>

            {/* Disclaimers */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">6. Disclaimers</h2>
              
              <h3 className="text-xl font-medium mb-3 mt-6">6.1 Opportunity Information</h3>
              <p className="text-muted-foreground leading-relaxed">
                ClinicalHours aggregates and displays clinical opportunity information from various sources and user contributions. We do not guarantee the accuracy, completeness, or availability of any opportunity listed on our Platform. Availability, requirements, and details may change without notice. <strong>Always verify information directly with the healthcare facility before applying.</strong>
              </p>
              
              <h3 className="text-xl font-medium mb-3 mt-6">6.2 No Professional Advice</h3>
              <p className="text-muted-foreground leading-relaxed">
                The Platform is for informational purposes only and does not constitute medical, legal, or professional advice. We are not responsible for any decisions you make based on information found on the Platform.
              </p>
              
              <h3 className="text-xl font-medium mb-3 mt-6">6.3 User-Generated Content</h3>
              <p className="text-muted-foreground leading-relaxed">
                Reviews, ratings, and community Q&A represent the opinions of individual users and do not reflect the views of ClinicalHours. We do not verify the accuracy of user-submitted content.
              </p>
              
              <h3 className="text-xl font-medium mb-3 mt-6">6.4 Service Availability</h3>
              <p className="text-muted-foreground leading-relaxed">
                The Platform is provided "as is" and "as available." We do not guarantee uninterrupted or error-free service and may modify or discontinue features at any time without notice.
              </p>
            </section>

            {/* Limitation of Liability */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">7. Limitation of Liability</h2>
              <p className="text-muted-foreground leading-relaxed">
                To the fullest extent permitted by law, ClinicalHours and its founders, employees, and affiliates shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-4">
                <li>Loss of data or information</li>
                <li>Loss of opportunities or potential opportunities</li>
                <li>Any errors or inaccuracies in opportunity listings</li>
                <li>Any actions taken by healthcare facilities or other users</li>
                <li>Service interruptions or technical issues</li>
                <li>Unauthorized access to your account or data</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-4">
                Our total liability for any claims arising from your use of the Platform shall not exceed the amount you paid to us (if any) in the twelve months preceding the claim.
              </p>
            </section>

            {/* Intellectual Property */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">8. Intellectual Property</h2>
              <p className="text-muted-foreground leading-relaxed">
                The ClinicalHours name, logo, and all original content, features, and functionality of the Platform are owned by ClinicalHours and are protected by copyright, trademark, and other intellectual property laws. You may not reproduce, distribute, or create derivative works without our express written permission.
              </p>
            </section>

            {/* Termination */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">9. Termination</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may suspend or terminate your account at any time for violations of these Terms or for any other reason at our discretion. You may delete your account at any time through your profile settings. Upon termination, your right to use the Platform will cease immediately.
              </p>
            </section>

            {/* Changes to Terms */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">10. Changes to Terms</h2>
              <p className="text-muted-foreground leading-relaxed">
                We reserve the right to modify these Terms at any time. We will notify users of material changes by posting the updated Terms on the Platform and updating the "Last updated" date. Your continued use of the Platform after changes constitutes acceptance of the new Terms.
              </p>
            </section>

            {/* Governing Law */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">11. Governing Law</h2>
              <p className="text-muted-foreground leading-relaxed">
                These Terms shall be governed by and construed in accordance with the laws of the United States, without regard to conflict of law principles.
              </p>
            </section>

            {/* Contact Information */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">12. Contact Us</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have any questions about these Terms and Conditions, please contact us at:
              </p>
              <p className="text-muted-foreground mt-4">
                <strong>Email:</strong> contact@clinicalhours.com
              </p>
            </section>
          </div>
        </main>
        
        <Footer />
      </div>
    </>
  );
};

export default Terms;
