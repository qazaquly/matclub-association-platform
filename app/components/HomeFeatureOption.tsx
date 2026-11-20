export function HomeFeatureOption({ selected = false }: { selected?: boolean }) {
  return <label className="content-field-wide home-feature-option"><input type="hidden" name="wasFeatured" value={selected ? "yes" : "no"}/><input type="checkbox" name="featureHome" defaultChecked={selected}/> Басты бетке шығару</label>;
}
