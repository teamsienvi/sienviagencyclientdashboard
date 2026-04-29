import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

export type SyncState = 'ready' | 'syncing_fresh' | 'syncing_stale' | 'stale' | 'degraded' | 'empty_failed' | 'overdue';

export function useSyncState(clientId: string, platform: string, module: string) {
    // 1. Fetch Sync Registry Status
    const { data: syncState, refetch } = useQuery({
        queryKey: ['sync_state', clientId, platform, module],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('sync_state_view' as any)
                .select('derived_status, last_synced_at, last_success_at, error_message')
                .eq('client_id', clientId)
                .eq('platform', platform)
                .eq('module', module)
                .maybeSingle();
            
            if (error) throw error;
            return (data as any) || { derived_status: 'empty_failed' };
        },
        enabled: !!clientId,
        refetchInterval: (query) => {
            const currentStatus = (query.state.data as any)?.derived_status;
            return (currentStatus === 'syncing_fresh' || currentStatus === 'syncing_stale') ? 3000 : false;
        }
    });
    const status = (syncState?.derived_status as SyncState) || 'ready';

    const [optimisticSyncing, setOptimisticSyncing] = useState(false);

    useEffect(() => {
        if (status !== 'stale' && status !== 'empty_failed') {
            setOptimisticSyncing(false);
        }
    }, [status]);

    // Safety timeout: never stay stuck in optimisticSyncing > 30s
    // This handles cases where the registry is for a different platform/module key
    // (e.g. youtube/youtube dispatches via orchestrate-sync but the worker marks
    // success on the same key, which may not match a pre-existing registry entry)
    useEffect(() => {
        if (!optimisticSyncing) return;
        const timer = setTimeout(() => {
            setOptimisticSyncing(false);
            refetch(); // re-read registry state
        }, 30_000);
        return () => clearTimeout(timer);
    }, [optimisticSyncing, refetch]);

    // 2. Hydration Order & Orchestration Dispatch
    useEffect(() => {
        if (!clientId) return;

        const orchestrate = async () => {
            if (status === 'stale' || status === 'empty_failed') {
                setOptimisticSyncing(true);
                // Silently dispatch background sync
                const { data } = await supabase.functions.invoke('orchestrate-sync', {
                    body: { clientId, platform, module }
                });
                
                if (data?.status === 'skipped') {
                    setOptimisticSyncing(false);
                }

                // Optimistically refetch state to show 'syncing'
                refetch();
            }
        };

        orchestrate();
    }, [status, clientId, platform, module, refetch]);

    const isSyncing = optimisticSyncing || status === 'syncing_fresh' || status === 'syncing_stale';
    const isDegraded = status === 'degraded' || status === 'overdue';

    return {
        status,
        isSyncing,
        isDegraded,
        lastSyncedAt: syncState?.last_synced_at,
        lastSuccessAt: syncState?.last_success_at,
        errorMessage: syncState?.error_message,
        retry: async () => {
            setOptimisticSyncing(true);
            await supabase.functions.invoke('orchestrate-sync', {
                body: { clientId, platform, module, forceRetry: true }
            });
            refetch();
        }
    };
}
