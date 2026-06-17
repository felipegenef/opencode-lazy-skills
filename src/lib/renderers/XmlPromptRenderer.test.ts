import { describe, it, expect } from 'bun:test';
import { createXmlPromptRenderer } from './XmlPromptRenderer';

describe('createXmlPromptRenderer', () => {
  const renderer = createXmlPromptRenderer();

  it('renders a Skill type', () => {
    const xml = renderer.render({
      type: 'Skill',
      data: {
        name: 'git-commit',
        toolName: 'git_commit',
        description: 'Write good commits',
        content: '## Rules\n\n- Keep it short',
        references: [],
        scripts: [],
        assets: [],
      },
    });

    expect(xml).toContain('<Skill>');
    expect(xml).toContain('<name>git-commit</name>');
    expect(xml).toContain('<toolName>git_commit</toolName>');
    expect(xml).toContain('<description>Write good commits</description>');
  });

  it('renders SkillSearchResults type with a names-only array', () => {
    const xml = renderer.render({
      type: 'SkillSearchResults',
      data: {
        skills: ['git-commit', 'go-testing'],
        summary: { matches: 2 },
      },
    });

    expect(xml).toContain('<SkillSearchResults>');
    // Names render as whole values, not character-by-character.
    expect(xml).toContain('<skills>git-commit</skills>');
    expect(xml).toContain('<skills>go-testing</skills>');
    expect(xml).toContain('<matches>2</matches>');
  });

  it('renders SkillInfoResults type', () => {
    const xml = renderer.render({
      type: 'SkillInfoResults',
      data: {
        skills: [{ name: 'git-commit', description: 'Write good commits' }],
        notFound: ['missing'],
      },
    });

    expect(xml).toContain('<SkillInfoResults>');
    expect(xml).toContain('<name>git-commit</name>');
    expect(xml).toContain('<description>Write good commits</description>');
    expect(xml).toContain('<notFound>missing</notFound>');
  });

  it('renders SkillResource type', () => {
    const xml = renderer.render({
      type: 'SkillResource',
      data: {
        resource_path: 'scripts/test.sh',
        resource_mimetype: 'text/x-shellscript',
      },
    });

    expect(xml).toContain('<SkillResource>');
    expect(xml).toContain('<resource_path>scripts/test.sh</resource_path>');
  });

  it('escapes XML entities', () => {
    const xml = renderer.render({
      type: 'Skill',
      data: {
        name: 'test & verify',
        description: 'a < b && c > d',
        content: "it's fine",
        references: [],
        scripts: [],
        assets: [],
      },
    });

    expect(xml).toContain('test &amp; verify');
    expect(xml).toContain('a &lt; b &amp;&amp; c &gt; d');
    expect(xml).toContain('it&apos;s fine');
  });

  it('returns empty root for unknown type', () => {
    const xml = renderer.render({ type: 'Unknown', data: {} });
    expect(xml).toBe('<Unknown></Unknown>');
  });

  it('converts resource maps to arrays', () => {
    const map = new Map();
    map.set('file.sh', { absolutePath: '/s/test.sh', mimeType: 'text/plain' });
    map.set('file2.sh', { absolutePath: '/s/test2.sh', mimeType: 'text/plain' });

    const xml = renderer.render({
      type: 'Skill',
      data: {
        name: 'test',
        description: 'desc',
        references: map,
        scripts: map,
        assets: new Map(),
      },
    });

    expect(xml).toContain('<relativePath>file.sh</relativePath>');
    expect(xml).toContain('<relativePath>file2.sh</relativePath>');
  });
});
