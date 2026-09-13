import {
  useQuery as usePowerSyncQuery,
  useStatus as usePowerSyncStatus,
} from "@powersync/react-native";
import { randomUUID } from "expo-crypto";
import { StatusBar } from "expo-status-bar";
import { Button, Card, Input, MoonIcon, SunIcon, Text, useThemeMode } from "panelui-native";
import { useState } from "react";
import { FlatList, Pressable, SafeAreaView, View } from "react-native";

import { authClient } from "@/lib/auth-client";
import { powerSync, usePowerSyncSession, type Item } from "@/lib/powersync";

export default function Index() {
  const session = authClient.useSession();
  const { mode, toggleMode } = useThemeMode();
  const powerSyncSession = usePowerSyncSession(
    session.isPending ? undefined : (session.data?.user.id ?? null),
    Boolean(session.error),
  );

  return (
    <SafeAreaView className="flex-1 bg-background">
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <View className="flex-1 gap-6 px-5 py-6">
        <View className="flex-row items-center justify-between">
          <Text size="3xl" weight="semibold">
            Callus
          </Text>
          <Button
            accessibilityLabel={`Switch to ${mode === "dark" ? "light" : "dark"} mode`}
            onPress={toggleMode}
            size="icon"
            variant="ghost"
          >
            {mode === "dark" ? <SunIcon size={20} /> : <MoonIcon size={20} />}
          </Button>
        </View>
        {session.isPending ? (
          <Text muted>Loading session…</Text>
        ) : session.error && powerSyncSession.activeUserId && powerSyncSession.ready ? (
          <ItemsPage
            userId={powerSyncSession.activeUserId}
            sessionError="Offline — couldn't verify your session. Local items remain available."
          />
        ) : !session.error && session.data?.user && powerSyncSession.ready ? (
          <ItemsPage userId={session.data.user.id} />
        ) : session.error ? (
          <Text className="text-destructive">
            Offline — couldn't verify your session, and no local owner was found.
          </Text>
        ) : session.data?.user ? (
          <Text muted>{powerSyncSession.error?.message ?? "Preparing local data…"}</Text>
        ) : (
          <AuthPage />
        )}
      </View>
    </SafeAreaView>
  );
}

function AuthPage() {
  const [signUp, setSignUp] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    setError(undefined);
    try {
      const result = signUp
        ? await authClient.signUp.email({ name, email, password })
        : await authClient.signIn.email({ email, password });
      if (result.error) setError(result.error.message ?? "Authentication failed");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <Card.Header>
        <Card.Title>{signUp ? "Create your account" : "Welcome back"}</Card.Title>
        <Card.Description>
          {signUp ? "Start with a private offline item list." : "Sign in to access your items."}
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <View className="gap-4">
          {signUp ? <Input label="Name" value={name} onChangeText={setName} isRequired /> : null}
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            isRequired
          />
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            isRequired
            errorMessage={error}
          />
          <Button fullWidth loading={submitting} onPress={() => void submit()}>
            {signUp ? "Sign up" : "Sign in"}
          </Button>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setSignUp((value) => !value);
              setError(undefined);
            }}
          >
            <Text className="text-center" muted>
              {signUp ? "Already have an account? Sign in" : "Need an account? Sign up"}
            </Text>
          </Pressable>
        </View>
      </Card.Content>
    </Card>
  );
}

function ItemsPage({ userId, sessionError }: { userId: string; sessionError?: string }) {
  const status = usePowerSyncStatus();
  const query = usePowerSyncQuery<Item>(
    "SELECT id, title, created_at, updated_at FROM item ORDER BY created_at DESC",
  );
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  async function createItem() {
    const title = draft.trim();
    if (!title || saving) return;
    setSaving(true);
    setError(undefined);
    const now = new Date().toISOString();
    try {
      await powerSync.execute(
        "INSERT INTO item (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        [randomUUID(), userId, title, now, now],
      );
      setDraft("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create item");
    } finally {
      setSaving(false);
    }
  }

  async function rename(itemId: string, title: string) {
    const nextTitle = title.trim();
    if (!nextTitle) return;
    try {
      await powerSync.execute("UPDATE item SET title = ?, updated_at = ? WHERE id = ?", [
        nextTitle,
        new Date().toISOString(),
        itemId,
      ]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not rename item");
    }
  }

  async function remove(itemId: string) {
    try {
      await powerSync.execute("DELETE FROM item WHERE id = ?", [itemId]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete item");
    }
  }

  return (
    <View className="flex-1 gap-4">
      <View className="flex-row items-center justify-between">
        <View>
          <Text size="xl" weight="semibold">
            Your items
          </Text>
          <Text size="sm" muted>
            {status.connected
              ? status.downloading || status.uploading
                ? "Syncing"
                : "Synced"
              : "Offline — changes are saved locally"}
          </Text>
        </View>
        <Button variant="outline" size="sm" onPress={() => void authClient.signOut()}>
          Log out
        </Button>
      </View>
      {sessionError ? <Text className="text-destructive">{sessionError}</Text> : null}
      {status.uploadError || status.downloadError ? (
        <Text className="text-destructive">
          {(status.uploadError ?? status.downloadError)?.message}
        </Text>
      ) : null}
      <View className="flex-row items-end gap-2">
        <View className="flex-1">
          <Input
            label="New item"
            value={draft}
            onChangeText={setDraft}
            errorMessage={error}
            onSubmitEditing={() => void createItem()}
            returnKeyType="done"
          />
        </View>
        <Button loading={saving} onPress={() => void createItem()}>
          Add
        </Button>
      </View>
      {query.isLoading ? (
        <Text muted>Loading items…</Text>
      ) : query.error ? (
        <Text className="text-destructive">Could not load local items: {query.error.message}</Text>
      ) : query.data.length === 0 ? (
        <Text muted>No items yet. Add one above.</Text>
      ) : (
        <FlatList
          data={query.data}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ItemRow item={item} onRename={rename} onDelete={remove} />}
          contentContainerClassName="gap-3"
        />
      )}
    </View>
  );
}

function ItemRow({
  item,
  onRename,
  onDelete,
}: {
  item: Item;
  onRename: (id: string, title: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [title, setTitle] = useState(item.title ?? "");
  return (
    <Card>
      <Card.Content>
        <View className="flex-row items-center gap-2">
          <View className="flex-1">
            <Input
              value={title}
              onChangeText={setTitle}
              onSubmitEditing={() => void onRename(item.id, title)}
              returnKeyType="done"
            />
          </View>
          <Button size="sm" variant="destructive" onPress={() => void onDelete(item.id)}>
            Delete
          </Button>
        </View>
      </Card.Content>
    </Card>
  );
}
