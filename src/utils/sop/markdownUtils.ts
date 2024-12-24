interface Section {
  title: string;
  content: string;
  startIndex: number;
  endIndex: number;
}

export function extractMarkdownSections(markdown: string): Record<string, string> {
  const sections: Section[] = [];
  const lines = markdown.split('\n');
  let currentSection: Section | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('## ')) {
      // If we were tracking a section, set its end index to the current line
      if (currentSection) {
        currentSection.endIndex = i - 1;
        sections.push(currentSection);
      }
      
      // Start tracking a new section
      currentSection = {
        title: line.substring(3).toLowerCase().trim(),
        content: line + '\n',
        startIndex: i,
        endIndex: lines.length - 1  // Default to end of document
      };
    } else if (currentSection) {
      currentSection.content += line + '\n';
    }
  }

  // Add the last section if there was one
  if (currentSection) {
    sections.push(currentSection);
  }

  // Convert sections array to a map of section name -> content
  return sections.reduce((acc, section) => {
    // Normalize section names to match our expected keys
    const key = section.title
      .replace(/\s+/g, '')
      .replace(/^(roles?and)?responsibilities$/i, 'rolesAndResponsibilities');
    
    acc[key] = section.content.trim();
    return acc;
  }, {} as Record<string, string>);
}

export function reconstructMarkdown(
  title: string,
  sections: Record<string, string>,
  sectionOrder: string[] = ['purpose', 'scope', 'rolesAndResponsibilities', 'procedure', 'documents']
): string {
  const parts = [title];

  for (const sectionKey of sectionOrder) {
    if (sections[sectionKey]) {
      parts.push(sections[sectionKey]);
    }
  }

  return parts.filter(Boolean).join('\n\n') + '\n';
}
