import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '../hooks/useAuth';
import { useBusinessDirectory } from '../hooks/useBusinessDirectory';
import type { MainTabsScreenProps } from '../navigation/types';
import type { AppColors } from '../theme';
import { radii, shadows, spacing, typography } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';
import type { ChatMessage, SupportMessage } from '../types/business';

function chatTime(value?: string) {
  if (!value) {
    return '';
  }

  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function isSupportMessage(message: ChatMessage | SupportMessage): message is SupportMessage {
  return 'senderRole' in message;
}

export function ChatsScreen(_props: MainTabsScreenProps<'Chats'>) {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const {
    getChatConversations,
    getNotificationsForUser,
    getSupportConversation,
    sendChatMessage,
    sendSupportMessage,
  } =
    useBusinessDirectory();
  const [isThreadOpen, setIsThreadOpen] = useState(false);
  const [activeBusinessId, setActiveBusinessId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const supportConversation = getSupportConversation(user);
  const supportMessages = supportConversation?.messages ?? [];
  const lastSupportMessage = supportConversation?.lastMessage;
  const advertiserConversations = getChatConversations(user);
  const activeAdvertiserConversation = activeBusinessId
    ? advertiserConversations.find((conversation) => conversation.business.id === activeBusinessId)
    : undefined;
  const activeMessages: Array<ChatMessage | SupportMessage> =
    activeAdvertiserConversation?.messages ?? supportMessages;
  const notifications = getNotificationsForUser(user).filter(
    (notification) => !notification.readAt,
  );

  if (!user) {
    return null;
  }

  const handleSend = () => {
    if (!draft.trim()) {
      return;
    }

    if (activeAdvertiserConversation) {
      sendChatMessage(activeAdvertiserConversation.business.id, user, draft);
    } else {
      sendSupportMessage(user, draft);
    }

    setDraft('');
  };

  if (!isThreadOpen) {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.title}>Messages</Text>
          <Text style={styles.subtitle}>Private chats with customer advertisers and support.</Text>
        </View>

        {user.role === 'businessOwner' && notifications.length > 0 ? (
          <View style={styles.notificationPanel}>
            <View style={styles.notificationHeader}>
              <Ionicons color={colors.primary} name="notifications-outline" size={20} />
              <Text style={styles.notificationTitle}>Order notifications</Text>
            </View>
            {notifications.slice(0, 5).map((notification) => (
              <View key={notification.id} style={styles.notificationCard}>
                <Text style={styles.notificationCardTitle}>{notification.title}</Text>
                <Text style={styles.notificationCardBody}>{notification.body}</Text>
                <Text style={styles.conversationTime}>{chatTime(notification.createdAt)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {advertiserConversations.length > 0 ? (
          advertiserConversations.map((conversation) => (
            <Pressable
              key={conversation.business.id}
              onPress={() => {
                setActiveBusinessId(conversation.business.id);
                setIsThreadOpen(true);
              }}
              style={({ pressed }) => [styles.conversationRow, pressed && styles.rowPressed]}
            >
              <Image
                resizeMode="cover"
                source={{ uri: conversation.business.imageUrl }}
                style={styles.avatarImage}
              />
              <View style={styles.conversationCopy}>
                <View style={styles.conversationLine}>
                  <Text numberOfLines={1} style={styles.conversationTitle}>
                    {conversation.business.ownerName}
                  </Text>
                  <Text style={styles.conversationTime}>
                    {chatTime(conversation.lastMessage.createdAt)}
                  </Text>
                </View>
                <Text numberOfLines={1} style={styles.conversationText}>
                  {conversation.business.name} - {conversation.lastMessage.text}
                </Text>
              </View>
            </Pressable>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No advertiser messages yet</Text>
            <Text style={styles.emptyText}>
              Tap Message Advertiser on an advertisement to start a private conversation.
            </Text>
          </View>
        )}

        <Pressable
          onPress={() => {
            setActiveBusinessId(null);
            setIsThreadOpen(true);
          }}
          style={({ pressed }) => [styles.conversationRow, pressed && styles.rowPressed]}
        >
          <View style={styles.avatarShell}>
            <Ionicons color={colors.white} name="headset-outline" size={20} />
          </View>
          <View style={styles.conversationCopy}>
            <View style={styles.conversationLine}>
              <Text numberOfLines={1} style={styles.conversationTitle}>
                View2Connect support
              </Text>
              <Text style={styles.conversationTime}>{chatTime(lastSupportMessage?.createdAt)}</Text>
            </View>
            <Text numberOfLines={1} style={styles.conversationText}>
              {lastSupportMessage?.text ?? 'Tap to message customer care.'}
            </Text>
          </View>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.threadHeader}>
        <Pressable
          onPress={() => setIsThreadOpen(false)}
          style={({ pressed }) => [styles.backButton, pressed && styles.rowPressed]}
        >
          <Ionicons color={colors.primary} name="chevron-back-outline" size={22} />
        </Pressable>
        {activeAdvertiserConversation ? (
          <Image
            resizeMode="cover"
            source={{ uri: activeAdvertiserConversation.business.imageUrl }}
            style={styles.avatarImage}
          />
        ) : (
          <View style={styles.avatarShell}>
            <Ionicons color={colors.white} name="headset-outline" size={20} />
          </View>
        )}
        <View style={styles.conversationCopy}>
          <Text style={styles.conversationTitle}>
            {activeAdvertiserConversation
              ? activeAdvertiserConversation.business.ownerName
              : 'View2Connect support'}
          </Text>
          <Text style={styles.conversationText}>
            {activeAdvertiserConversation
              ? activeAdvertiserConversation.business.name
              : 'Replies appear here.'}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.messageList} showsVerticalScrollIndicator={false}>
        <View style={styles.messageStack}>
          {activeMessages.length > 0 ? (
            activeMessages.map((message) => {
              const isCare = isSupportMessage(message)
                ? message.senderRole === 'customerCare' ||
                  message.senderRole === 'owner' ||
                  message.senderRole === 'system'
                : message.senderUserId !== user.id && message.senderName !== user.fullName;

              return (
                <View
                  key={message.id}
                  style={[
                    styles.messageRow,
                    isCare ? styles.messageRowCare : styles.messageRowUser,
                  ]}
                >
                  <View
                    style={[
                      styles.messageBubble,
                      isCare ? styles.messageBubbleCare : styles.messageBubbleUser,
                    ]}
                  >
                    <Text
                      style={[
                        styles.messageText,
                        isCare ? styles.messageTextCare : styles.messageTextUser,
                      ]}
                    >
                      {message.text}
                    </Text>
                  </View>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>
                {activeAdvertiserConversation ? 'Start this advertiser chat' : 'Start with customer care'}
              </Text>
              <Text style={styles.emptyText}>
                {activeAdvertiserConversation
                  ? 'Ask about the advertisement, location, price, inspection, or direct contact.'
                  : 'Ask about an order, subscription, delivery, pickup, listing approval, or account support.'}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.composer}>
        <TextInput
          onChangeText={setDraft}
          placeholder={activeAdvertiserConversation ? 'Message advertiser' : 'Message customer care'}
          placeholderTextColor={colors.textMuted}
          style={styles.composerInput}
          value={draft}
        />
        <Pressable
          onPress={handleSend}
          style={({ pressed }) => [styles.sendButton, pressed && styles.rowPressed]}
        >
          <Ionicons color={colors.white} name="send" size={18} />
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      gap: spacing.md,
    },
    header: {
      gap: 2,
    },
    title: {
      ...typography.title,
      color: colors.text,
    },
    subtitle: {
      ...typography.body,
      color: colors.textMuted,
    },
    conversationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: radii.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      ...shadows.soft,
    },
    rowPressed: {
      opacity: 0.9,
    },
    avatarShell: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 46,
      width: 46,
      borderRadius: 23,
      backgroundColor: colors.primary,
    },
    avatarImage: {
      height: 46,
      width: 46,
      borderRadius: 23,
      backgroundColor: colors.card,
    },
    conversationCopy: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    conversationLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    conversationTitle: {
      ...typography.bodyStrong,
      color: colors.text,
      flex: 1,
    },
    conversationText: {
      ...typography.caption,
      color: colors.textMuted,
    },
    conversationTime: {
      ...typography.caption,
      color: colors.textMuted,
    },
    threadHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: radii.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      ...shadows.soft,
    },
    backButton: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 38,
      width: 38,
      borderRadius: 19,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    messageList: {
      flex: 1,
      borderRadius: radii.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      ...shadows.soft,
    },
    messageStack: {
      gap: spacing.sm,
    },
    messageRow: {
      flexDirection: 'row',
    },
    messageRowUser: {
      justifyContent: 'flex-end',
    },
    messageRowCare: {
      justifyContent: 'flex-start',
    },
    messageBubble: {
      maxWidth: '82%',
      borderRadius: radii.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    messageBubbleUser: {
      backgroundColor: colors.primary,
      borderBottomRightRadius: 4,
    },
    messageBubbleCare: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderBottomLeftRadius: 4,
    },
    messageText: {
      ...typography.body,
    },
    messageTextUser: {
      color: colors.white,
    },
    messageTextCare: {
      color: colors.text,
    },
    emptyCard: {
      gap: spacing.xs,
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    emptyTitle: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    emptyText: {
      ...typography.caption,
      color: colors.textMuted,
    },
    notificationPanel: {
      gap: spacing.sm,
      borderRadius: radii.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      ...shadows.soft,
    },
    notificationHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    notificationTitle: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    notificationCard: {
      gap: 4,
      borderRadius: radii.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    notificationCardTitle: {
      ...typography.bodyStrong,
      color: colors.text,
    },
    notificationCardBody: {
      ...typography.caption,
      color: colors.textMuted,
    },
    composer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    composerInput: {
      flex: 1,
      minHeight: 48,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      color: colors.text,
      paddingHorizontal: spacing.md,
      ...typography.body,
    },
    sendButton: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 48,
      width: 48,
      borderRadius: 24,
      backgroundColor: colors.primary,
    },
  });
}
