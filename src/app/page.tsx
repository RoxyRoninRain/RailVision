import DesignStudio from './DesignStudio';
import { getStyles } from './actions';

export default async function Page() {
  // Server-side fetch
  const styles = await getStyles();

  // Fallback if DB empty or error (to ensure UI still works during dev)
  const safeStyles = styles.length > 0 ? styles : [
    { id: '1', name: 'Industrial', description: 'Raw steel and exposed elements' },
    { id: '2', name: 'Modern Minimalist', description: 'Clean lines and glass' },
    { id: '3', name: 'Rustic', description: 'Wood and iron' }
  ];

  return <DesignStudio styles={safeStyles} />;
}
