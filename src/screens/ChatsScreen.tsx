import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '../hooks/useAuth';
import { useBusinessDirectory } from '../hooks/useBusinessDirectory';
import type { MainTabsScreenProps } from '../navigation/types';
import type { AppColors } from '../theme';
import { radii, shadows, spacing, typography } from '../theme';
import { useAppTheme } from '../theme/ThemeProvider';
import type {
  ChatAttachmentType,
  ChatMessage,
  ChatMessageAttachment,
  SupportMessage,
} from '../types/business';

function chatTime(value?: string) {
  if (!value) {
    return '';
  }

  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function isSupportMessage(message: ChatMessage | SupportMessage): message is SupportMessage {
  return 'senderRole' in message;
}

function attachmentTypeFromMime(mimeType?: string | null, name = ''): ChatAttachmentType {
  const lowerMime = mimeType?.toLowerCase() ?? '';
  const lowerName = name.toLowerCase();

  if (lowerMime.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(lowerName)) {
    return 'image';
  }

  if (lowerMime.startsWith('video/') || /\.(mp4|mov|webm)$/i.test(lowerName)) {
    return 'video';
  }

  return 'file';
}

function attachmentIcon(type: ChatAttachmentType): keyof typeof Ionicons.glyphMap {
  if (type === 'image') {
    return 'image-outline';
  }

  if (type === 'video') {
    return 'videocam-outline';
  }

  return 'document-attach-outline';
}

function fallbackAttachmentName(uri: string, fallback: string) {
  return uri.split('/').pop()?.split('?')[0] || fallback;
}

function formatAttachmentSize(size?: number) {
  if (!size || size <= 0) {
    return '';
  }

  if (size < 1024 * 1024) {
    return `${Math.ceil(size / 1024)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
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
  const [selectedAttachments, setSelectedAttachments] = useState<ChatMessageAttachment[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
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

  const handlePickMedia = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        'Permission needed',
        'Allow gallery access in your device settings so you can attach photos or videos.',
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      allowsMultipleSelection: true,
      mediaTypes: ['images', 'videos'],
      quality: 0.85,
      selectionLimit: 6,
    });

    if (result.canceled) {
      return;
    }

    const pickedAttachments = result.assets.map<ChatMessageAttachment>((asset, index) => {
      const name = asset.fileName ?? fallbackAttachmentName(asset.uri, `Media ${index + 1}`);
      const type = asset.type === 'video' ? 'video' : 'image';

      return {
        id: `attachment-${Date.now()}-${index}`,
        type,
        url: asset.uri,
        name,
        ...(asset.mimeType ? { mimeType: asset.mimeType } : {}),
        ...(asset.fileSize ? { size: asset.fileSize } : {}),
      };
    });

    setSelectedAttachments((current) => [...current, ...pickedAttachments].slice(-6));
    setSendError(null);
  };

  const handlePickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: true,
      type: '*/*',
    });

    if (result.canceled) {
      return;
    }

    const pickedAttachments = result.assets.map<ChatMessageAttachment>((asset, index) => ({
      id: `attachment-${Date.now()}-${index}`,
      type: attachmentTypeFromMime(asset.mimeType, asset.name),
      url: asset.uri,
      name: asset.name || fallbackAttachmentName(asset.uri, `File ${index + 1}`),
      ...(asset.mimeType ? { mimeType: asset.mimeType } : {}),
      ...(asset.size ? { size: asset.size } : {}),
    }));

    setSelectedAttachments((current) => [...current, ...pickedAttachments].slice(-6));
    setSendError(null);
  };

  const removeSelectedAttachment = (attachmentId: string) => {
    setSelectedAttachments((current) =>
      current.filter((attachment) => attachment.id !== attachmentId),
    );
  };

  const handleSend = async () => {
    if (!draft.trim() && selectedAttachments.length === 0) {
      return;
    }

    try {
      setIsSending(true);
      setSendError(null);

      if (activeAdvertiserConversation) {
        await sendChatMessage(
          activeAdvertiserConversation.business.id,
          user,
          draft,
          selectedAttachments,
        );
      } else {
        await sendSupportMessage(user, draft, undefined, selectedAttachments);
      }

      setDraft('');
      setSelectedAttachments([]);
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Unable to send this message.');
    } finally {
      setIsSending(false);
    }
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
              const attachments = message.attachments ?? [];

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
                    {attachments.length > 0 ? (
                      <View style={styles.messageAttachmentStack}>
                        {attachments.map((attachment) =>
                          attachment.type === 'image' ? (
                            <Pressable
                              key={attachment.id}
                              onPress={() => {
                                void Linking.openURL(attachment.url);
                              }}
                              style={({ pressed }) => [
                                styles.messageImageAttachment,
                                pressed && styles.rowPressed,
                              ]}
                            >
                              <Image
                                resizeMode="cover"
                                source={{ uri: attachment.url }}
                                style={styles.messageAttachmentImage}
                              />
                              <Text numberOfLines={1} style={styles.messageAttachmentName}>
                                {attachment.name}
                              </Text>
                            </Pressable>
                          ) : (
                            <Pressable
                              key={attachment.id}
                              onPress={() => {
                                void Linking.openURL(attachment.url);
                              }}
                              style={({ pressed }) => [
                                styles.messageFileAttachment,
                                pressed && styles.rowPressed,
                              ]}
                            >
                              <Ionicons
                                color={colors.primary}
                                name={attachmentIcon(attachment.type)}
                                size={18}
                              />
                              <View style={styles.attachmentCopy}>
                                <Text numberOfLines={1} style={styles.messageAttachmentName}>
                                  {attachment.name}
                                </Text>
                                <Text style={styles.messageAttachmentMeta}>
                                  {attachment.type === 'video' ? 'Video' : 'File'}{' '}
                                  {formatAttachmentSize(attachment.size)}
                                </Text>
                              </View>
                            </Pressable>
                          ),
                        )}
                      </View>
                    ) : null}
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

      {sendError ? <Text style={styles.errorText}>{sendError}</Text> : null}
      {selectedAttachments.length > 0 ? (
        <View style={styles.selectedAttachmentPanel}>
          <ScrollView
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.selectedAttachmentRow}
          >
            {selectedAttachments.map((attachment) => (
              <View key={attachment.id} style={styles.selectedAttachmentChip}>
                <Ionicons
                  color={colors.primary}
                  name={attachmentIcon(attachment.type)}
                  size={17}
                />
                <Text numberOfLines={1} style={styles.selectedAttachmentText}>
                  {attachment.name}
                </Text>
                <Pressable
                  accessibilityLabel={`Remove ${attachment.name}`}
                  onPress={() => removeSelectedAttachment(attachment.id)}
                  style={({ pressed }) => [
                    styles.removeAttachmentButton,
                    pressed && styles.rowPressed,
                  ]}
                >
                  <Ionicons color={colors.textMuted} name="close-outline" size={16} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}
      <View style={styles.composer}>
        <Pressable
          accessibilityLabel="Attach photo or video"
          onPress={() => void handlePickMedia()}
          style={({ pressed }) => [styles.attachButton, pressed && styles.rowPressed]}
        >
          <Ionicons color={colors.primary} name="image-outline" size={20} />
        </Pressable>
        <Pressable
          accessibilityLabel="Attach file"
          onPress={() => void handlePickFile()}
          style={({ pressed }) => [styles.attachButton, pressed && styles.rowPressed]}
        >
          <Ionicons color={colors.primary} name="document-attach-outline" size={20} />
        </Pressable>
        <TextInput
          onChangeText={setDraft}
          placeholder={activeAdvertiserConversation ? 'Message advertiser' : 'Message customer care'}
          placeholderTextColor={colors.textMuted}
          style={styles.composerInput}
          value={draft}
        />
        <Pressable
          disabled={isSending || (!draft.trim() && selectedAttachments.length === 0)}
          onPress={() => void handleSend()}
          style={({ pressed }) => [
            styles.sendButton,
            pressed && styles.rowPressed,
            (isSending || (!draft.trim() && selectedAttachments.length === 0)) && styles.sendButtonDisabled,
          ]}
        >
          <Ionicons color={colors.white} name={isSending ? 'hourglass-outline' : 'send'} size={18} />
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
    messageAttachmentStack: {
      gap: spacing.xs,
      marginTop: spacing.xs,
    },
    messageImageAttachment: {
      overflow: 'hidden',
      width: 178,
      borderRadius: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    messageAttachmentImage: {
      height: 132,
      width: '100%',
    },
    messageFileAttachment: {
      maxWidth: 230,
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.sm,
    },
    attachmentCopy: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    messageAttachmentName: {
      ...typography.caption,
      color: colors.text,
      fontWeight: '800',
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
    },
    messageAttachmentMeta: {
      ...typography.caption,
      color: colors.textMuted,
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
    selectedAttachmentPanel: {
      borderRadius: radii.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.sm,
    },
    selectedAttachmentRow: {
      gap: spacing.sm,
    },
    selectedAttachmentChip: {
      maxWidth: 220,
      minHeight: 38,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderRadius: radii.pill,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      paddingLeft: spacing.sm,
      paddingRight: 4,
    },
    selectedAttachmentText: {
      ...typography.caption,
      color: colors.text,
      maxWidth: 140,
      fontWeight: '700',
    },
    removeAttachmentButton: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 28,
      width: 28,
      borderRadius: 14,
      backgroundColor: colors.surface,
    },
    attachButton: {
      alignItems: 'center',
      justifyContent: 'center',
      height: 44,
      width: 44,
      borderRadius: 22,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
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
    sendButtonDisabled: {
      opacity: 0.55,
    },
    errorText: {
      ...typography.caption,
      color: colors.danger,
    },
  });
}
