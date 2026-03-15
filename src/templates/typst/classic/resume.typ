#set page(
  paper: "a4",
  margin: (top: 1.35cm, bottom: 1.35cm, left: 1.55cm, right: 1.55cm),
)

#let data = json("resume.json")
#let theme = data.theme
#let accent = rgb(theme.accentHex)
#let text_muted = rgb(theme.mutedHex)
#let divider = rgb(theme.dividerHex)
#let ink = rgb(theme.inkHex)

#set text(
  font: ("Helvetica Neue", "Apple SD Gothic Neo", "Arial Unicode MS"),
  size: 9.45pt,
  lang: "ko",
  fill: ink,
)

#set par(
  justify: false,
  leading: 0.63em,
)

#show link: set text(fill: accent)

#let body_copy(content) = text(size: 9.05pt, fill: text_muted)[#content]
#let meta_copy(content) = text(size: 8.35pt, fill: text_muted)[#content]

#let section_title(title) = [
  #v(0.95em)
  #grid(
    columns: (auto, 1fr),
    column-gutter: 6pt,
    align(center)[#text(size: 14pt, weight: "bold", fill: accent)[#title]],
    align(bottom)[#line(length: 100%, stroke: (paint: divider, thickness: 0.8pt))],
  )
  #v(0.28em)
]

#let inline_join(contents, separator: [#text(fill: text_muted)[ • ]]) = [
  #for (index, content) in contents.enumerate() [
    #if index > 0 [
      #h(0.35em)
      #separator
      #h(0.35em)
    ]
    #content
  ]
]

#let linked_value(item) = {
  if item.url == "" {
    [#item.display]
  } else {
    [#link(item.url)[#item.display]]
  }
}

#let body_paragraphs(items) = [
  #for paragraph in items [
    #body_copy(paragraph)
    #v(0.16em)
  ]
]

#let bullet_list(items, gap: 0.1em) = [
  #for item in items [
    #grid(
      columns: (8pt, 1fr),
      column-gutter: 3pt,
      [#text(size: 8.5pt, fill: accent)[•]],
      [#text(size: 8.95pt, fill: text_muted)[#item]],
    )
    #v(gap)
  ]
]

#let entry_header(title, right_text) = grid(
  columns: (3fr, 1.25fr),
  column-gutter: 8pt,
  [#text(size: 10.15pt, weight: "bold")[#title]],
  [#align(right)[#text(size: 8.55pt, fill: text_muted)[#right_text]]],
)

#let project_entry(project) = [
  #grid(
    columns: (2.6fr, 1.4fr),
    column-gutter: 8pt,
    [
      #text(size: 10pt, weight: "bold")[#project.name]
      #if project.subtitle != "" [
        #h(0.35em)
        #text(size: 8.6pt, fill: text_muted)[#project.subtitle]
      ]
    ],
    [
      #if project.link != "" [
        #align(right)[#text(size: 8.4pt)[#link(project.link)[#project.linkLabel]]]
      ]
    ],
  )
  #if project.meta != "" [
    #v(0.08em)
    #meta_copy(project.meta)
  ]
  #if project.description != "" [
    #v(0.08em)
    #body_copy(project.description)
  ]
  #if project.highlights.len() > 0 [
    #v(0.12em)
    #bullet_list(project.highlights)
  ]
]

#let skill_row(label, value) = grid(
  columns: (32mm, 1fr),
  column-gutter: 8pt,
  [#text(size: 8.9pt, weight: "bold")[#label]],
  [#body_copy(value)],
)

#align(center)[
  #text(size: 25pt, weight: "bold")[#data.name]
  #if data.desiredPosition != "" or data.careerDuration != "" [
    #v(0.12em)
    #if data.desiredPosition != "" [
      #text(size: 10pt, weight: "bold", fill: accent)[#data.desiredPosition]
    ]
    #if data.desiredPosition != "" and data.careerDuration != "" [
      #h(0.45em)
      #text(size: 9.4pt, weight: "bold", fill: accent)[•]
      #h(0.45em)
    ]
    #if data.careerDuration != "" [
      #text(size: 10pt, weight: "bold", fill: accent)[#data.careerDuration]
    ]
  ]
  #if data.headline != "" [
    #v(0.24em)
    #text(size: 9.35pt, weight: "bold")[#data.headline]
  ]
  #if data.targetCompany != "" or data.targetJobTitle != "" [
    #v(0.18em)
    #text(size: 8.5pt, fill: text_muted)[Tailored for #data.targetCompany #if data.targetJobTitle != "" [· #data.targetJobTitle]]
  ]
  #if data.contacts.len() > 0 [
    #v(0.18em)
    #text(size: 8.8pt)[#inline_join(data.contacts.map(linked_value))]
  ]
]

#for section in data.sections [
  #section_title([#section.title])
  #body_paragraphs(section.paragraphs)
]

#if data.experience.len() > 0 [
  #section_title([Experience])
  #for item in data.experience [
    #entry_header(item.role, item.period)
    #if item.company != "" [
      #v(0.05em)
      #text(size: 8.65pt, weight: "bold", fill: text_muted)[#item.company]
    ]
    #if item.description != "" [
      #v(0.08em)
      #body_copy(item.description)
    ]
    #v(0.18em)
  ]
]

#if data.achievements.len() > 0 [
  #section_title([Highlights])
  #bullet_list(data.achievements)
]

#if data.projects.len() > 0 [
  #section_title([Projects])
  #for project in data.projects [
    #project_entry(project)
    #v(0.28em)
  ]
]

#section_title([Skills])
#for group in data.techGroups [
  #if group.items.len() > 0 [
    #skill_row(group.label, group.items.join(", "))
    #v(0.12em)
  ]
]

#if data.strengths.len() > 0 [
  #section_title([Strengths])
  #bullet_list(data.strengths)
]
