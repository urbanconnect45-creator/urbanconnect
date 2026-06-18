export const privacyPolicyTitle = 'UrbanConnect Privacy Policy';
export const userAgreementTitle = 'UrbanConnect User Agreement';

export const privacyPolicySections = [
  {
    title: '1. Overview',
    body:
      'UrbanConnect is a private estate marketplace for River Park residents, business owners, customer care teams, and administrators. This Privacy Policy explains how UrbanConnect collects, uses, stores, shares, and protects information when people create accounts, list businesses, make payments, place orders, upload media, contact support, or use administrative tools.',
  },
  {
    title: '2. Information We Collect',
    body:
      'We collect account details such as name, email address, phone number, role, estate, cluster, business name, and signup date. Business owners may provide business contact details, addresses, product or service descriptions, prices, inventory details, gallery images, videos, payment references, subscription details, and payout KYC details such as BVN or NIN when required for withdrawal. Residents may provide delivery details, order notes, payment status information, and support messages.',
  },
  {
    title: '3. Verification And Estate Access',
    body:
      'UrbanConnect is designed for River Park access. Business owner accounts may be reviewed by customer care or an owner administrator to confirm that the person or business is connected to the estate. Verification decisions may use account information, contact details, inspection notes, support conversations, and listing information.',
  },
  {
    title: '4. Payments',
    body:
      'Subscription payments are handled through the UrbanConnect account balance or another approved payment alternative. UrbanConnect may store payment references, amount, currency, plan cycle, paid date, payout KYC reference, and confirmation details.',
  },
  {
    title: '5. Media And Uploaded Content',
    body:
      'When a business owner grants gallery permission, UrbanConnect may let the owner select images or videos for listings and business profiles. Uploaded or selected media should be accurate, lawful, safe for public viewing, and related to the listed product, service, or business.',
  },
  {
    title: '6. Support, Notifications, And Emails',
    body:
      'Messages sent to customer care may be visible to authorized admin users for support, safety, order coordination, payment resolution, and account review. UrbanConnect may create in-app notifications and email logs for signup inspection notices, payment updates, order updates, listing status, and customer care responses.',
  },
  {
    title: '7. How Information Is Used',
    body:
      'Information is used to create and secure accounts, operate the marketplace, verify River Park eligibility, display approved listings, process subscriptions, coordinate orders, provide customer care, send operational notices, monitor misuse, maintain audit logs, and improve marketplace reliability.',
  },
  {
    title: '8. Sharing And Access',
    body:
      'Residents can see public listing information for approved businesses. Business owners can see their own listings, orders, subscription status, notifications, and support history. Admin users can access operational information according to their role. Payment providers receive the information required to process or verify payments, wallet accounts, and seller withdrawals.',
  },
  {
    title: '9. Data Security',
    body:
      'UrbanConnect should be configured to keep payment secret keys and webhook verification on secure backend services, not in the mobile or web client. Administrators should use strong credentials, restrict access to trusted staff, and review audit logs for sensitive actions.',
  },
  {
    title: '10. Retention And Corrections',
    body:
      'UrbanConnect may retain account, order, support, email, notification, audit, and payment records for operational, legal, security, and dispute-resolution purposes. Users may contact customer care to request correction of inaccurate profile, listing, or contact information.',
  },
  {
    title: '11. Legal Review',
    body:
      'This policy is a professional product template for the UrbanConnect app and should be reviewed by qualified legal counsel before production launch or public distribution.',
  },
];

export const userAgreementSections = [
  {
    title: '1. Acceptance',
    body:
      'By creating an account, signing in, listing a business, paying a subscription, placing an order, or contacting customer care, you agree to follow this User Agreement, the Privacy Policy, marketplace rules, admin verification requirements, and any lawful instructions issued by UrbanConnect customer care.',
  },
  {
    title: '2. River Park Eligibility',
    body:
      'UrbanConnect is currently limited to River Park Estate. Users must provide accurate identity, contact, estate, and cluster information. Business owners understand that signup does not guarantee approval and that UrbanConnect may inspect or verify estate connection before granting full marketplace visibility.',
  },
  {
    title: '3. Business Owner Responsibilities',
    body:
      'Business owners must provide accurate business names, descriptions, prices, stock levels, service details, contact information, media, and pickup or service locations. Listings must not be misleading, unsafe, unlawful, offensive, counterfeit, or unrelated to the stated business activity.',
  },
  {
    title: '4. Subscription And Payment Terms',
    body:
      'Business owners need an active paid subscription before listings become public. UrbanConnect may pause, hide, or unverify listings when payment expires, fails, is refunded, or cannot be verified.',
  },
  {
    title: '5. Listings, Inspection, And Verification',
    body:
      'UrbanConnect may review listings, media, prices, stock, business identity, estate eligibility, and customer care history before approving public visibility. Listing verification is separate from River Park residency verification and subscription payment status.',
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
      'UrbanConnect may suspend accounts, archive listings, remove media, restrict checkout, pause signups, or revoke verification where there is suspected fraud, inaccurate information, policy abuse, failed payment, safety risk, or misuse of the marketplace.',
  },
  {
    title: '9. No Guarantee',
    body:
      'UrbanConnect helps connect residents and estate businesses, but it does not guarantee uninterrupted availability, business performance, product quality, service outcomes, payment-provider uptime, or approval of every listing or account.',
  },
  {
    title: '10. Updates',
    body:
      'UrbanConnect may update this agreement as the marketplace grows. Continued use after updates means the user accepts the revised terms. Material changes should be surfaced in the app or through customer care communication where practical.',
  },
];

export function getCombinedPolicyText() {
  return [...privacyPolicySections, ...userAgreementSections]
    .map((section) => `${section.title}\n${section.body}`)
    .join('\n\n');
}
