"use client";
import { useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { IconButton } from "@astryxdesign/core/IconButton";
import { TextInput } from "@astryxdesign/core/TextInput";

export function CoreSkillsEditor({ catalog, selected, disabled, onChange }: { catalog: string[]; selected: string[]; disabled: boolean; onChange: (selected: string[], catalog: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [error, setError] = useState("");
  const candidates = catalog.filter((skill) => !selected.includes(skill) && skill.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  function move(index: number, direction: number) {
    const next = [...selected];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    onChange(next, catalog);
  }
  function remove(skill: string) { onChange(selected.filter((item) => item !== skill), catalog); }
  return <section className="core-skills-editor" aria-label="핵심 기술 편집">
    <header><div><h3>핵심 기술 <span>{selected.length}개</span></h3><p>상단에 보여줄 기술만 골라 주세요. 프로젝트별 기술은 그대로 유지됩니다.</p></div><Button label={open ? "편집 완료" : "기술 편집"} variant="secondary" onClick={() => setOpen(!open)} /></header>
    <ul className="core-skills-selected" aria-label="선택한 핵심 기술">{selected.map((skill) => <li key={skill}><span>{skill}</span><IconButton label={`${skill} 선택 해제`} tooltip="선택 해제" icon={<span aria-hidden="true">×</span>} size="sm" variant="ghost" isDisabled={disabled} onClick={() => remove(skill)} /></li>)}</ul>
    {selected.length === 0 && <p>선택한 기술이 없습니다. ‘기술 편집’에서 추가해 주세요.</p>}
    {open && <section className="core-skills-tools" aria-label="기술 편집 도구">
      {disabled && <p role="status">결과 검토로 돌아가 남은 수정 요청을 먼저 마무리해 주세요.</p>}
      <div className="core-skills-picker"><TextInput label="기술 후보 검색" value={query} onChange={setQuery} />
        <div className="core-skills-candidates" aria-label="추가할 기술 후보">{candidates.map((skill) => <Button key={skill} label={`${skill} 추가`} variant="secondary" size="sm" isDisabled={disabled} onClick={() => onChange([...selected, skill], catalog)} />)}{candidates.length === 0 && <p>일치하는 후보가 없습니다. 아래에서 직접 추가할 수 있습니다.</p>}</div>
      </div>
      <div className="core-skills-arrange"><h4>표시 순서와 이름</h4><ol className="core-skills-order" aria-label="핵심 기술 표시 순서">{selected.map((skill, index) => <li key={skill}><span>{index + 1}. {skill}</span><div>
        <IconButton label={`${skill} 앞으로`} tooltip="앞으로 이동" icon={<span aria-hidden="true">↑</span>} size="sm" variant="ghost" isDisabled={disabled || index === 0} onClick={() => move(index, -1)} />
        <IconButton label={`${skill} 뒤로`} tooltip="뒤로 이동" icon={<span aria-hidden="true">↓</span>} size="sm" variant="ghost" isDisabled={disabled || index === selected.length - 1} onClick={() => move(index, 1)} />
        <Button label={`${skill} 이름 수정`} variant="ghost" size="sm" isDisabled={disabled} onClick={() => { setRenaming(skill); setName(skill); setError(""); }} />
      </div></li>)}</ol></div>
      <form className="core-skills-add" onSubmit={(event) => {
        event.preventDefault();
        const value = name.trim();
        if (!value || disabled) return;
        if (catalog.some((item) => item !== renaming && item.toLowerCase() === value.toLowerCase())) { setError("이미 등록된 기술입니다. 후보 검색에서 추가해 주세요."); return; }
        if (value.length > 120 || catalog.length >= 300 && !renaming) { setError("기술은 120자 이하, 후보는 300개까지 등록할 수 있습니다."); return; }
        onChange(renaming ? selected.map((item) => item === renaming ? value : item) : [...selected, value], renaming ? catalog.map((item) => item === renaming ? value : item) : [...catalog, value]);
        setName(""); setRenaming(null); setError("");
      }}>
        <TextInput label={renaming ? "수정할 기술명" : "추가할 기술"} value={name} onChange={setName} isDisabled={disabled} />
        <Button type="submit" label={renaming ? "기술명 저장" : "기술 추가"} isDisabled={disabled || !name.trim()} />
        {renaming && <Button label="기술명 수정 취소" variant="ghost" onClick={() => { setRenaming(null); setName(""); setError(""); }} />}
      </form>
      {error && <p role="alert">{error}</p>}
    </section>}
  </section>;
}
