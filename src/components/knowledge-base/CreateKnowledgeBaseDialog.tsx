import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { CreateKnowledgeBaseInput } from '../../types/knowledge-base';

interface CreateKnowledgeBaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CreateKnowledgeBaseInput) => Promise<void>;
}

export function CreateKnowledgeBaseDialog({ open, onOpenChange, onSubmit }: CreateKnowledgeBaseDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onSubmit({ name: name.trim(), description: description.trim() || undefined });
      setName('');
      setDescription('');
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[400px] bg-[var(--color-surface)] text-[var(--color-text-primary)] rounded-lg p-6 shadow-lg border border-[var(--color-border)]">
          <Dialog.Title className="text-lg font-semibold">新建知识库</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-[var(--color-text-secondary)]">
            创建一个新的知识库来管理你的文档
          </Dialog.Description>
          <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-3">
            <div>
              <label htmlFor="kb-name" className="block text-sm font-medium mb-1">
                名称 *
              </label>
              <input
                id="kb-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="输入知识库名称"
                className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:border-[var(--color-accent)]"
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="kb-description" className="block text-sm font-medium mb-1">
                描述
              </label>
              <textarea
                id="kb-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="输入知识库描述（可选）"
                rows={3}
                className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:border-[var(--color-accent)] resize-none"
              />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Dialog.Close asChild>
                <button type="button" className="px-4 py-2 text-sm rounded border border-[var(--color-border)] hover:bg-[var(--color-btn-ghost-hover)]">
                  取消
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={!name.trim() || loading}
                className="px-4 py-2 text-sm rounded bg-[var(--color-accent)] text-[var(--color-on-accent)] hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
              >
                {loading ? '创建中...' : '创建'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
