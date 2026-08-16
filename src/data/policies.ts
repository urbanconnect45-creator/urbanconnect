import privacyPolicyDocument from './privacyPolicy.json';

export const privacyPolicyTitle = privacyPolicyDocument.title;
export const userAgreementTitle = 'View2Connect User Agreement';

export const privacyPolicySections = privacyPolicyDocument.sections;

export const userAgreementSections = [
  {
    title: '1. Acceptance',
    body:
      'By creating an account, signing in, listing a business, paying a subscription, or placing an order, you agree to follow this User Agreement, the Privacy Policy, marketplace rules, admin verification requirements, and any lawful instructions issued by View2Connect.',
  },
  {
    title: '2. Marketplace Eligibility',
    body:
      'Users must provide accurate identity, contact, delivery, and location information. Business owners understand that registration does not guarantee approval and that View2Connect may inspect or verify business information before granting full marketplace visibility.',
  },
  {
    title: '3. Business Owner Responsibilities',
    body:
      'Business owners must provide accurate business names, descriptions, prices, stock levels, service details, contact information, media, and pickup or service locations. Listings must not be misleading, unsafe, unlawful, offensive, counterfeit, or unrelated to the stated business activity.',
  },
  {
    title: '4. Subscription And Payment Terms',
    body:
      'Business owners need an active paid subscription before listings become public. View2Connect may pause, hide, or unverify listings when payment expires, fails, is refunded, or cannot be verified.',
  },
  {
    title: '5. Listings, Inspection, And Verification',
    body:
      'View2Connect may review listings, media, prices, stock, business identity, service location, and support history before approving public visibility. Listing verification is separate from seller-account verification and subscription payment status.',
  },
  {
    title: '6. Orders And Fulfillment',
    body:
      'Residents agree to provide accurate delivery details and payment information. Business owners agree to prepare confirmed items or services promptly after payment confirmation and to cooperate with customer care for support-center collection, delivery coordination, or service resolution.',
  },
  {
    title: '7. Customer Care Communications',
    body:
      'Messages sent through customer care may be reviewed by authorized admin users. Users must communicate respectfully and must not send threats, spam, fraud attempts, unlawful content, abusive language, or private payment credentials through support messages.',
  },
  {
    title: '8. Account Suspension',
    body:
      'View2Connect may suspend accounts, archive listings, remove media, restrict checkout, pause signups, or revoke verification where there is suspected fraud, inaccurate information, policy abuse, failed payment, safety risk, or misuse of the marketplace.',
  },
  {
    title: '9. No Guarantee',
    body:
      'View2Connect helps connect customers and businesses, but it does not guarantee uninterrupted availability, business performance, product quality, service outcomes, payment-provider uptime, or approval of every listing or account.',
  },
  {
    title: '10. Updates',
    body:
      'View2Connect may update this agreement as the marketplace grows. Continued use after updates means the user accepts the revised terms. Material changes should be surfaced in the app or through support communication where practical.',
  },
];

export function getCombinedPolicyText() {
  return [...privacyPolicySections, ...userAgreementSections]
    .map((section) => `${section.title}\n${section.body}`)
    .join('\n\n');
}
