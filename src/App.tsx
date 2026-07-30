import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { KnowledgeBaseList } from './components/knowledge-base/KnowledgeBaseList';
import { KnowledgeBaseOverview } from './components/knowledge-base/KnowledgeBaseOverview';
import { DocumentList } from './components/document/DocumentList';
import { DocumentDetailPage } from './components/document/DocumentDetailPage';
import { SettingsPage } from './components/settings/SettingsPage';
import { KnowledgeBaseChatLayout, ChatSessionPlaceholder } from './components/chat/KnowledgeBaseChatLayout';
import { ChatInterface } from './components/chat/ChatInterface';

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<KnowledgeBaseList />} />
          <Route path="kb/:id" element={<KnowledgeBaseOverview />} />
          <Route path="kb/:id/documents" element={<DocumentList />} />
          <Route path="kb/:id/chat" element={<KnowledgeBaseChatLayout />}>
            <Route index element={<ChatSessionPlaceholder />} />
            <Route path=":conversationId" element={<ChatInterface />} />
          </Route>
          <Route path="documents/:id" element={<DocumentDetailPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="settings/ollama" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
