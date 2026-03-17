#set page(
  paper: "a4",
  margin: (top: 1.2cm, bottom: 1.2cm, left: 1.35cm, right: 1.35cm),
)

#let data = json("resume.json")
#let theme = data.theme
#let accent = rgb(theme.accentHex)
#let soft = rgb(theme.softHex)
#let divider = rgb(theme.dividerHex)
#let ink = rgb(theme.inkHex)
#let text_muted = rgb(theme.mutedHex)
#let on_accent = rgb(theme.onAccentHex)

#set text(
  font: ("Helvetica Neue", "Apple SD Gothic Neo", "Arial Unicode MS"),
  size: 9.15pt,
  lang: "ko",
  fill: ink,
)

#set par(
  justify: false,
  leading: 0.62em,
)

#show link: set text(fill: accent)

#let body_copy(content) = text(size: 8.85pt, fill: text_muted)[#content]
#let meta_copy(content) = text(size: 8.15pt, fill: text_muted)[#content]

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
  #v(0.9em)
  #grid(
    columns: (auto, 1fr),
    column-gutter: 8pt,
    [
      #box(
        fill: soft,
        inset: (x: 8pt, y: 3pt),
        radius: 999pt,
      )[
        #text(size: 8.2pt, weight: "bold", fill: accent)[#title]
      ]
    ],
    [#line(length: 100%, stroke: (paint: divider, thickness: 0.9pt))],
  )
  #v(0.18em)
]

#let bullet_list(items, gap: 0.06em) = [
  #for item in items [
    #grid(
      columns: (8pt, 1fr),
      column-gutter: 4pt,
      [#text(size: 8.3pt, fill: accent)[▪]],
      [#text(size: 8.8pt, fill: text_muted)[#item]],
    )
    #v(gap)
  ]
]

#let callout_title(title) = text(size: 8.25pt, weight: "bold", fill: accent)[#title]

#let experience_entry(item) = [
  #grid(
    columns: (2.7fr, 1.2fr),
    column-gutter: 10pt,
    [#text(size: 10.05pt, weight: "bold")[#item.role]],
    [#align(right)[#text(size: 8.2pt, fill: text_muted)[#item.period]]],
  )
  #if item.company != "" [
    #v(0.05em)
    #text(size: 8.45pt, weight: "bold", fill: accent)[#item.company]
  ]
  #if item.description != "" [
    #v(0.07em)
    #body_copy(item.description)
  ]
]

#let project_entry(project) = [
  #grid(
    columns: (2.35fr, 1fr),
    column-gutter: 9pt,
    [
      #text(size: 9.85pt, weight: "bold")[#project.name]
      #if project.subtitle != "" [
        #h(0.28em)
        #text(size: 8.2pt, fill: accent)[#project.subtitle]
      ]
    ],
    [
      #if project.link != "" [
        #align(right)[#text(size: 8pt)[#link(project.link)[#project.linkLabel]]]
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

#let profile_photo(width: 18mm, height: 18mm, radius: 8pt) = {
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

#box(
  fill: accent,
  inset: 13pt,
  radius: 18pt,
)[
  #grid(
    columns: (2.2fr, 1fr),
    column-gutter: 14pt,
    [
      #block[#text(size: 23pt, weight: "bold", fill: on_accent)[#data.name]]
      #if data.headline != "" [
        #v(0.02em)
        #block[#text(size: 9.2pt, weight: "bold", fill: on_accent)[#data.headline]]
      ]
      #if data.desiredPosition != "" or data.careerDuration != "" [
        #v(0.02em)
        #block[#text(size: 8.65pt, fill: on_accent)[
          #data.desiredPosition
          #if data.desiredPosition != "" and data.careerDuration != "" [ · ]
          #data.careerDuration
        ]]
      ]
    ],
    [
      #align(right)[
        #profile_photo()
        #if data.showProfileImage and data.profileImagePath != "" [
          #v(0.16em)
        ]
        #if data.targetCompany != "" or data.targetJobTitle != "" [
          #text(size: 8.15pt, fill: on_accent)[#if data.targetCompany != "" [#data.targetCompany] #if data.targetCompany != "" and data.targetJobTitle != "" [ · ] #if data.targetJobTitle != "" [#data.targetJobTitle]]
          #v(0.08em)
        ]
        #if data.contacts.len() > 0 [
          #text(size: 8.15pt, fill: on_accent)[#inline_join(data.contacts.map(linked_value), separator: [#text(fill: on_accent)[ • ]])]
        ]
      ]
    ],
  )
]

#for section in data.sections [
  #section_title([#section.title])
  #box(
    fill: soft,
    inset: 10pt,
    radius: 14pt,
  )[
    #for paragraph in section.paragraphs [
      #body_copy(paragraph)
      #v(0.12em)
    ]
  ]
]

#if data.achievements.len() > 0 or data.strengths.len() > 0 [
  #v(0.9em)
  #grid(
    columns: (1fr, 1fr),
    column-gutter: 10pt,
    [
      #if data.achievements.len() > 0 [
        #box(
          fill: soft,
          inset: 10pt,
          radius: 14pt,
        )[
          #callout_title([Highlights])
          #v(0.16em)
          #bullet_list(data.achievements)
        ]
      ]
    ],
    [
      #if data.strengths.len() > 0 [
        #box(
          fill: soft,
          inset: 10pt,
          radius: 14pt,
        )[
          #callout_title([Strengths])
          #v(0.16em)
          #bullet_list(data.strengths)
        ]
      ]
    ],
  )
]

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
    #v(0.22em)
  ]
]

#section_title([Skills])
#for group in data.techGroups [
  #if group.items.len() > 0 [
    #box(
      fill: soft,
      inset: 9pt,
      radius: 14pt,
    )[
      #grid(
        columns: (24mm, 1fr),
        column-gutter: 8pt,
        [#callout_title([#group.label])],
        [#body_copy(group.items.join(", "))],
      )
    ]
    #v(0.14em)
  ]
]
