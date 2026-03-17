#set page(
  paper: "a4",
  margin: (top: 1.32cm, bottom: 1.25cm, left: 1.42cm, right: 1.42cm),
)

#let data = json("resume.json")
#let theme = data.theme
#let accent = rgb(theme.accentHex)
#let soft = rgb(theme.softHex)
#let divider = rgb(theme.dividerHex)
#let ink = rgb(theme.inkHex)
#let text_muted = rgb(theme.mutedHex)

#set text(
  font: ("Iowan Old Style", "Georgia", "Times New Roman", "Apple SD Gothic Neo", "Arial Unicode MS"),
  size: 9.25pt,
  lang: "ko",
  fill: ink,
)

#set par(
  justify: false,
  leading: 0.66em,
)

#show link: set text(fill: accent)

#let body_copy(content) = text(size: 8.9pt, fill: text_muted)[#content]
#let meta_copy(content) = text(size: 8.05pt, fill: text_muted)[#content]

#let inline_join(contents, separator: [#text(fill: text_muted)[ • ]]) = [
  #for (index, content) in contents.enumerate() [
    #if index > 0 [
      #h(0.3em)
      #separator
      #h(0.3em)
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

#let section_title(title) = [
  #v(0.72em)
  #grid(
    columns: (auto, 1fr),
    column-gutter: 7pt,
    [
      #text(size: 7.6pt, weight: "bold", fill: accent, tracking: 0.08em)[#title]
    ],
    [
      #line(length: 100%, stroke: (paint: divider, thickness: 0.75pt))
    ],
  )
  #v(0.12em)
]

#let bullet_list(items, gap: 0.06em) = [
  #for item in items [
    #grid(
      columns: (8pt, 1fr),
      column-gutter: 4pt,
      [#text(size: 8.1pt, fill: accent)[•]],
      [#text(size: 8.55pt, fill: text_muted)[#item]],
    )
    #v(gap)
  ]
]

#let experience_entry(item) = [
  #grid(
    columns: (2.6fr, 1fr),
    column-gutter: 8pt,
    [#text(size: 9.95pt, weight: "bold")[#item.role]],
    [#align(right)[#text(size: 8pt, fill: text_muted)[#item.period]]],
  )
  #if item.company != "" [
    #v(0.04em)
    #text(size: 8.15pt, weight: "bold", fill: accent)[#item.company]
  ]
  #if item.description != "" [
    #v(0.06em)
    #body_copy(item.description)
  ]
]

#let project_entry(project) = [
  #grid(
    columns: (2.3fr, 1fr),
    column-gutter: 8pt,
    [
      #text(size: 9.8pt, weight: "bold")[#project.name]
      #if project.subtitle != "" [
        #h(0.25em)
        #text(size: 8pt, fill: accent)[#project.subtitle]
      ]
    ],
    [
      #if project.link != "" [
        #align(right)[#text(size: 7.9pt)[#link(project.link)[#project.linkLabel]]]
      ]
    ],
  )
  #if project.meta != "" [
    #v(0.05em)
    #meta_copy(project.meta)
  ]
  #if project.description != "" [
    #v(0.06em)
    #body_copy(project.description)
  ]
  #if project.highlights.len() > 0 [
    #v(0.08em)
    #bullet_list(project.highlights)
  ]
]

#let profile_photo(width: 18mm, height: 18mm, radius: 9pt) = {
  if data.showProfileImage and data.profileImagePath != "" {
    [
      #box(
        radius: radius,
        clip: true,
      )[
        #image(data.profileImagePath, width: width, height: height, fit: "cover")
      ]
    ]
  } else {
    []
  }
}

#grid(
  columns: (1fr, auto),
  column-gutter: 10pt,
  [
    #if data.targetCompany != "" or data.targetJobTitle != "" [
      #block[#text(size: 7.65pt, weight: "bold", fill: accent, tracking: 0.08em)[#if data.targetCompany != "" [#data.targetCompany] #if data.targetCompany != "" and data.targetJobTitle != "" [ · ] #if data.targetJobTitle != "" [#data.targetJobTitle]]]
      #v(0.08em)
    ]
    #block[#text(size: 24pt, weight: "bold")[#data.name]]
    #if data.desiredPosition != "" or data.careerDuration != "" [
      #v(0.005em)
      #block[#text(size: 9.05pt, weight: "bold", fill: accent)[
        #data.desiredPosition
        #if data.desiredPosition != "" and data.careerDuration != "" [ • ]
        #data.careerDuration
      ]]
    ]
    #if data.headline != "" [
      #v(0.015em)
      #block[#text(size: 9.05pt, fill: ink)[#data.headline]]
    ]
    #if data.contacts.len() > 0 [
      #v(0.04em)
      #block[#text(size: 8.4pt)[#inline_join(data.contacts.map(linked_value))]]
    ]
  ],
  [
    #align(right + top)[#profile_photo()]
  ],
)

#if data.sections.len() > 0 [
  #section_title([About Me])
  #for paragraph in data.sections.at(0).paragraphs [
    #body_copy(paragraph)
    #v(0.12em)
  ]
]

#grid(
  columns: (2.1fr, 0.95fr),
  column-gutter: 13pt,
  [
    #if data.experience.len() > 0 [
      #section_title([Experience])
      #for item in data.experience [
        #experience_entry(item)
        #v(0.2em)
      ]
    ]

    #if data.projects.len() > 0 [
      #section_title([Projects])
      #for project in data.projects [
        #project_entry(project)
        #v(0.26em)
      ]
    ]
  ],
  [
    #if data.achievements.len() > 0 [
      #section_title([Highlights])
      #bullet_list(data.achievements)
    ]

    #if data.techGroups.len() > 0 [
      #section_title([Skills])
      #for group in data.techGroups [
        #if group.items.len() > 0 [
          #text(size: 8.05pt, weight: "bold")[#group.label]
          #v(0.03em)
          #body_copy(group.items.join(", "))
          #v(0.18em)
        ]
      ]
    ]

    #if data.strengths.len() > 0 [
      #section_title([Strengths])
      #bullet_list(data.strengths)
    ]
  ],
)
