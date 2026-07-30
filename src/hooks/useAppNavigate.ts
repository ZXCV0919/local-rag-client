import { useCallback } from 'react';
import type { NavigateFunction, NavigateOptions, To } from 'react-router-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { useNavigationGuardStore } from '../store/navigation-guard';
import { useChatStore } from '../store/chat';

/** 知识库对话页：/kb/:id/chat 或 /kb/:id/chat/:conversationId */
function isChatRoute(pathname: string): boolean {
  return /^\/kb\/[^/]+\/chat(\/.*)?$/.test(pathname);
}

function normalizePath(path: string): string {
  return path.split('?')[0].split('#')[0];
}

/**
 * 在「回答生成中」且当前位于对话页、即将离开对话时弹出确认；
 * 已在后台生成时，对话外的跳转不再拦截。To 为非 string 时不拦截。
 */
export function useAppNavigate(): NavigateFunction {
  const rrNavigate = useNavigate();
  const location = useLocation();

  return useCallback<NavigateFunction>((to: To | number, options?: NavigateOptions) => {
    if (typeof to === 'number') {
      rrNavigate(to);
      return;
    }
    if (typeof to !== 'string') {
      rrNavigate(to, options ?? {});
      return;
    }

    const path = normalizePath(to.trim());
    const onChatPage = isChatRoute(location.pathname);
    const leavingChat = onChatPage && !isChatRoute(path);

    if (!useChatStore.getState().pipelineRunning || !leavingChat) {
      rrNavigate(path, options ?? {});
      return;
    }

    useNavigationGuardStore.getState().openForNavigation(path, options);
  }, [rrNavigate, location.pathname]);
}
