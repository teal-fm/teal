import * as React from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { useStore } from '@/stores/mainStore';
import AuthOptions from '../auth/options';

import { Redirect, Stack } from 'expo-router';
import ActorView from '@/components/actor/actorView';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';

export default function Screen() {
  const router = useRouter();
  const j = useStore((state) => state.status);
  // @me
  const agent = useStore((state) => state.pdsAgent);
  const profile = useStore((state) => state.profiles[agent?.did ?? '']);
  const tealDid = useStore((state) => state.tealDid);
  const [hasTealProfile, setHasTealProfile] = useState<boolean | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchProfile = async () => {
      try {
        if (!agent || !tealDid) return;
        let res = await agent.call(
          'fm.teal.alpha.actor.getProfile',
          { actor: agent?.did },
          {},
          { headers: { 'atproto-proxy': tealDid + '#teal_fm_appview' } },
        );
        if (isMounted) {
          setHasTealProfile(true);
        }
      } catch (error) {
        setHasTealProfile(false);
        console.error('Error fetching profile:', error);
        if (
          error instanceof Error &&
          error.message.includes('could not resolve proxy did')
        ) {
          router.replace('/offline');
        }
      }
    };

    fetchProfile();

    return () => {
      isMounted = false;
    };
  }, [agent, tealDid, router]);

  if (j !== 'loggedIn') {
    return <AuthOptions />;
  }

  if (hasTealProfile !== null && !hasTealProfile) {
    return (
      <View className="flex-1 justify-center items-center gap-5 p-6 bg-background">
        <Redirect href="/onboarding" />
      </View>
    );
  }

  // TODO: replace with skeleton
  if (!profile || !agent) {
    return (
      <View className="flex-1 justify-center items-center gap-5 p-6 bg-background">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 justify-start items-center gap-5 bg-background w-full">
      <Stack.Screen
        options={{
          title: 'Home',
          headerBackButtonDisplayMode: 'minimal',
          headerShown: false,
        }}
      />
      <ActorView actorDid={agent.did!} pdsAgent={agent} />
    </ScrollView>
  );
}
