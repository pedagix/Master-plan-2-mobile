export function hasContent(items) {
  if (Array.isArray(items)) return items.length > 0;
  if (typeof items === 'number') return items > 0;
  return Boolean(items);
}

export default function ContentSection({ title, items, children, headingLevel = 2, className = 'stack' }) {
  if (!hasContent(items)) return null;
  const Heading = headingLevel === 3 ? 'h3' : 'h2';

  return <section className={className}><Heading>{title}</Heading>{children}</section>;
}
