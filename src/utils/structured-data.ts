export interface FaqItem {
  question: string;
  answer: string;
}

function plainText(markdown: string) {
  return markdown
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[`*_~>#|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractFaqItems(body = ''): FaqItem[] {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === '## Häufige Fragen');
  if (start === -1) return [];

  const items: FaqItem[] = [];
  let question = '';
  let answer: string[] = [];

  const flush = () => {
    const cleanQuestion = plainText(question);
    const cleanAnswer = plainText(answer.join('\n'));
    if (cleanQuestion && cleanAnswer) items.push({ question: cleanQuestion, answer: cleanAnswer });
  };

  for (const line of lines.slice(start + 1)) {
    if (/^##\s+/.test(line)) break;
    if (/^###\s+/.test(line)) {
      flush();
      question = line.replace(/^###\s+/, '').trim();
      answer = [];
      continue;
    }
    if (question) answer.push(line);
  }
  flush();
  return items;
}

