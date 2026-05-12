import { useTranslation } from '../contexts/I18nContext';

interface StatusChipProps {
  status: string;
  onClick?: () => void;
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-surface-container-high text-on-surface-variant',
  in_progress: 'bg-primary-fixed text-on-primary-fixed',
  done: 'bg-tertiary-fixed text-on-tertiary-fixed',
};

export default function StatusChip({ status, onClick }: StatusChipProps) {
  const { t } = useTranslation();

  const STATUS_LABELS: Record<string, string> = {
    pending: t('Pending'),
    in_progress: t('In Progress'),
    done: t('Done'),
  };

  const style = STATUS_STYLES[status] || 'bg-surface-container-high text-on-surface-variant';
  const label = STATUS_LABELS[status] || status;

  if (onClick) {
    return (
      <button onClick={onClick} className={`px-3 py-1 rounded-full text-xs font-bold ${style} cursor-pointer`}>
        {label}
      </button>
    );
  }

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-bold ${style}`}>
      {label}
    </span>
  );
}
