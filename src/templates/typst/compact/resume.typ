#set page(
  paper: "a4",
  margin: (top: 1.08cm, bottom: 1.08cm, left: 1.18cm, right: 1.18cm),
)

#let data = json("resume.json")
#let theme = data.theme
#let accent = rgb(theme.accentHex)
#let soft = rgb(theme.softHex)
#let divider = rgb(theme.dividerHex)
#let ink = rgb(theme.inkHex)
#let text_muted = rgb(theme.mutedHex)

#set text(
  font: ("Helvetica Neue", "Apple SD Gothic Neo", "Arial Unicode MS"),
  size: 8.95pt,
  lang: "ko",
  fill: ink,
)

#set par(
  justify: false,
  leading: 0.62em,
)

#show link: set text(fill: accent)

#let body_copy(content) = text(size: 8.65pt, fill: text_muted)[#content]
#let meta_copy(content) = text(size: 7.9pt, fill: text_muted)[#content]

#let inline_join(contents, separator: [#text(fill: text_muted)[ • ]]) = [
  #for (index, content) in contents.enumerate() [
    #if index > 0 [
      #h(0.24em)
      #separator
      #h(0.24em)
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

#let bullet_list(items, gap: 0.05em) = [
  #for item in items [
    #grid(
      columns: (7pt, 1fr),
      column-gutter: 3pt,
      [#text(size: 8pt, fill: accent)[•]],
      [#text(size: 8.35pt, fill: text_muted)[#item]],
    )
    #v(gap)
  ]
]

#let rail_heading(title) = [
  #text(size: 7.7pt, weight: "bold", fill: accent)[#title]
]

#let rail_section(title, content) = [
  #v(0.75em)
  #rail_heading(title)
  #v(0.08em)
  #line(length: 100%, stroke: (paint: divider, thickness: 0.7pt))
  #v(0.12em)
  #content
]

#let experience_entry(item) = [
  #grid(
    columns: (2.7fr, 1fr),
    column-gutter: 8pt,
    [#text(size: 9pt, weight: "bold")[#item.role]],
    [#align(right)[#text(size: 7.8pt, fill: text_muted)[#item.period]]],
  )
  #if item.company != "" [
    #v(0.04em)
    #text(size: 7.95pt, weight: "bold", fill: accent)[#item.company]
  ]
  #if item.description != "" [
    #v(0.06em)
    #body_copy(item.description)
  ]
]

#let project_entry(project) = [
  #grid(
    columns: (2.2fr, 1fr),
    column-gutter: 8pt,
    [
      #text(size: 8.95pt, weight: "bold")[#project.name]
      #if project.subtitle != "" [
        #h(0.24em)
        #text(size: 7.75pt, fill: text_muted)[#project.subtitle]
      ]
    ],
    [
      #if project.link != "" [
        #align(right)[#text(size: 7.7pt)[#link(project.link)[#project.linkLabel]]]
      ]
    ],
  )
  #if project.meta != "" [
    #v(0.05em)
    #meta_copy(project.meta)
  ]
  #if project.description != "" [
    #v(0.05em)
    #body_copy(project.description)
  ]
  #if project.highlights.len() > 0 [
    #v(0.08em)
    #bullet_list(project.highlights)
  ]
]

#let profile_photo(width: 100%, height: 22mm, radius: 12pt) = {
  if data.showProfileImage and data.profileImagePath != "" {
    [
      #box(
        width: width,
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
  columns: (31mm, 1fr),
  column-gutter: 12pt,
  [
    #box(
      fill: soft,
      inset: 9pt,
      radius: 16pt,
    )[
      #profile_photo()
      #if data.showProfileImage and data.profileImagePath != "" [
        #v(0.12em)
      ]
      #block[#text(size: 18.5pt, weight: "bold")[#data.name]]
      #if data.desiredPosition != "" [
        #v(0.01em)
        #block[#text(size: 8.5pt, weight: "bold", fill: accent)[#data.desiredPosition]]
      ]
      #if data.careerDuration != "" [
        #v(0.01em)
        #block[#text(size: 8.15pt, fill: text_muted)[#data.careerDuration]]
      ]
      #if data.headline != "" [
        #v(0.08em)
        #block[#text(size: 8.25pt, weight: "bold")[#data.headline]]
      ]
      #if data.targetCompany != "" or data.targetJobTitle != "" [
        #v(0.22em)
        #text(size: 7.75pt, fill: text_muted)[#if data.targetCompany != "" [#data.targetCompany] #if data.targetCompany != "" and data.targetJobTitle != "" [ · ] #if data.targetJobTitle != "" [#data.targetJobTitle]]
      ]
      #if data.contacts.len() > 0 [
        #v(0.35em)
        #text(size: 7.8pt)[#inline_join(data.contacts.map(linked_value))]
      ]

      #v(0.55em)
      #line(length: 100%, stroke: (paint: divider, thickness: 0.8pt))

      #v(0.45em)
      #rail_heading([Skills])
      #v(0.14em)
      #for group in data.techGroups [
        #if group.items.len() > 0 [
          #text(size: 7.8pt, weight: "bold")[#group.label]
          #v(0.04em)
          #body_copy(group.items.join(", "))
          #v(0.22em)
        ]
      ]

      #if data.strengths.len() > 0 [
        #v(0.16em)
        #rail_heading([Strengths])
        #v(0.14em)
        #bullet_list(data.strengths, gap: 0.03em)
      ]
    ]
  ],
  [
    #for section in data.sections [
      #rail_section([#section.title], [
        #for paragraph in section.paragraphs [
          #body_copy(paragraph)
          #v(0.12em)
        ]
      ])
    ]

    #if data.experience.len() > 0 [
      #rail_section([Experience], [
        #for item in data.experience [
          #experience_entry(item)
          #v(0.18em)
        ]
      ])
    ]

    #if data.achievements.len() > 0 [
      #rail_section([Highlights], [
        #bullet_list(data.achievements)
      ])
    ]

    #if data.projects.len() > 0 [
      #rail_section([Projects], [
        #for project in data.projects [
          #project_entry(project)
          #v(0.2em)
        ]
      ])
    ]
  ],
)
