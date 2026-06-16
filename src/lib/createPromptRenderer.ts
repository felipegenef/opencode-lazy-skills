import { createXmlPromptRenderer } from './renderers/XmlPromptRenderer';

export function createPromptRenderer() {
  const xmlRenderer = createXmlPromptRenderer();

  const getFormatter = () => xmlRenderer.render;

  return { getFormatter };
}
