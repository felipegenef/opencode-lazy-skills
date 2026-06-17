/**
 * XmlPromptRenderer - Format objects as XML (current default)
 *
 * WHY: Claude models are trained extensively on XML and prefer structured
 * XML injection for skill metadata and search results. This maintains the
 * current behavior as the default and recommended format for Claude models.
 */

import { jsonToXml } from '../xml';
import { resourceMapToArray } from './resourceMapToArray';

export const createXmlPromptRenderer = () => {
  const prepareSkill = (skill) => ({
    ...skill,
    references: resourceMapToArray(skill.references),
    scripts: resourceMapToArray(skill.scripts),
    assets: resourceMapToArray(skill.assets),
  });

  const render = (args) => {
    const rootElement = args.type || 'root';
    if (args.type === 'Skill') return jsonToXml(prepareSkill(args.data), rootElement);
    if (args.type === 'SkillResource') return jsonToXml(args.data, rootElement);
    if (args.type === 'SkillSearchResults') return jsonToXml(args.data, rootElement);
    if (args.type === 'SkillInfoResults') return jsonToXml(args.data, rootElement);
    return jsonToXml({}, rootElement);
  };

  return { render };
};
