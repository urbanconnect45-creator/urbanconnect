import { Component, type ErrorInfo, type PropsWithChildren, type ReactNode } from 'react';
import { DevSettings, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

type State = { error: Error | null };

export class AppErrorBoundary extends Component<PropsWithChildren, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (__DEV__) {
      console.error('View2Connect render failure', error, info.componentStack);
    }
  }

  private reload = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.reload();
      return;
    }

    DevSettings.reload();
  };

  render(): ReactNode {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <View style={styles.screen} accessibilityRole="alert">
        <View style={styles.panel}>
          <Text style={styles.title}>View2Connect needs to restart</Text>
          <Text style={styles.body}>
            Your account data is safe. Restart the app and try that action again.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={this.reload}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <Text style={styles.buttonLabel}>Restart app</Text>
          </Pressable>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f7f5fc',
  },
  panel: {
    width: '100%',
    maxWidth: 460,
    padding: 24,
    borderWidth: 1,
    borderColor: '#ded6f1',
    borderRadius: 8,
    backgroundColor: '#ffffff',
  },
  title: {
    color: '#21183a',
    fontSize: 22,
    fontWeight: '800',
  },
  body: {
    marginTop: 10,
    color: '#625a73',
    fontSize: 15,
    lineHeight: 22,
  },
  button: {
    minHeight: 48,
    marginTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#5B2BCB',
  },
  buttonPressed: {
    opacity: 0.82,
  },
  buttonLabel: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
});
