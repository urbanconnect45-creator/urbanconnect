import { Alert, Linking } from 'react-native';

import type { BusinessContact, ContactAction } from '../types/business';

function sanitizePhoneNumber(value: string) {
  return value.replace(/[^\d+]/g, '');
}

export function getContactActions(contact: BusinessContact): ContactAction[] {
  const actions: ContactAction[] = [
    {
      id: 'call',
      icon: 'call-outline',
      label: 'Call',
      value: contact.phone,
      url: `tel:${sanitizePhoneNumber(contact.phone)}`,
    },
    {
      id: 'email',
      icon: 'mail-outline',
      label: 'Email',
      value: contact.email,
      url: `mailto:${contact.email}`,
    },
  ];

  if (contact.whatsapp) {
    actions.splice(1, 0, {
      id: 'whatsapp',
      icon: 'logo-whatsapp',
      label: 'WhatsApp',
      value: contact.whatsapp,
      url: `https://wa.me/${sanitizePhoneNumber(contact.whatsapp).replace('+', '')}`,
    });
  }

  if (contact.website) {
    actions.push({
      id: 'website',
      icon: 'globe-outline',
      label: 'Website',
      value: contact.website,
      url: contact.website,
    });
  }

  return actions;
}

export async function openContactAction(action: ContactAction) {
  const supported = await Linking.canOpenURL(action.url);

  if (!supported) {
    Alert.alert('Unavailable', `Unable to open ${action.label.toLowerCase()} right now.`);
    return;
  }

  await Linking.openURL(action.url);
}

export async function openExternalUrl(url: string, label: string) {
  const supported = await Linking.canOpenURL(url);

  if (!supported) {
    Alert.alert('Unavailable', `Unable to open ${label.toLowerCase()} right now.`);
    return;
  }

  await Linking.openURL(url);
}
