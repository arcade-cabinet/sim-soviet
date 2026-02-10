import type { BuildingFlavorText } from './types';

export const BUILDING_FLAVOR: Record<string, BuildingFlavorText> = {
  // -- Coal Plant ---
  power: {
    placement:
      'A new Coal Plant rises from the earth, belching smoke into the already grey sky. The sky does not complain. It was grey before. It will be grey after. The smoke is merely a formality.',
    inspection:
      'INSPECTION REPORT: Output nominal. Smoke output: exceeds quota. Worker morale: "present." The boiler room contains one (1) motivational poster and zero (0) safety equipment. The poster reads: "Do Not Die." Compliance rate: variable.',
    decay:
      "The Coal Plant groans like an old man recounting his achievements. Rust has formed a workers' council and is negotiating for control of the east wall. Management has not noticed, as management is also rusting.",
    destruction:
      'The Coal Plant has been decommissioned. Its smoke, orphaned, drifts aimlessly above the city. Citizens report a brief, unsettling glimpse of blue sky before normal grey service resumes.',
  },

  // -- Tenement ---
  housing: {
    placement:
      'A concrete Tenement block materializes. It has all the charm of a filing cabinet and roughly the same amount of living space. Residents will learn to love it. They have no alternative.',
    inspection:
      'INSPECTION REPORT: 50 citizens reside here. Hallway lighting: one bulb per floor (when available). Hot water schedule: Tuesdays, 3AM-3:07AM. The elevator has been "temporarily" out of service since construction. Graffiti in stairwell reads: "At least the walls are thick." They are not.',
    decay:
      'Cracks appear in the tenement walls. Residents stuff them with newspaper, which also serves as insulation, decoration, and reading material. The building now leans 3 degrees to the left. This is attributed to "socialist architectural character."',
    destruction:
      'The Tenement has been demolished. Residents were given 24 hours notice and 0 hours of alternative housing. They have been reclassified as "outdoor enthusiasts."',
  },

  // -- Kolkhoz (Farm) ---
  farm: {
    placement:
      'A Collective Farm (Kolkhoz) has been established. The soil is questionable. The seeds are optimistic. The farmers are neither. Potato production commences, as is tradition.',
    inspection:
      'INSPECTION REPORT: Crop yield: adequate by recently-revised standards. Tractor count: 1. Tractor functionality: decorative. The scarecrow has been promoted to Assistant Farm Manager after demonstrating superior work ethic (standing motionless for 12 hours without complaint).',
    decay:
      'The Kolkhoz is experiencing a "transitional harvest phase." Translated: the crops have stopped growing. The soil has filed a grievance. The potatoes, meanwhile, have achieved sentience and are planning a modest escape.',
    destruction:
      'The Kolkhoz has been dissolved. The land will be repurposed. The potatoes have been liberated. Where they went is classified. The farmers have been reassigned to another farm. The other farm is this farm. Carry on.',
  },

  // -- Vodka Plant ---
  distillery: {
    placement:
      'A Vodka Plant opens, answering the question no one asked but everyone was thinking. Production begins immediately. Quality control consists of a single worker who tastes the output and gives a thumbs up. He has not put his thumb down in 14 years.',
    inspection:
      'INSPECTION REPORT: Output exceeds demand. Demand also exceeds output. Both statistics are correct simultaneously. Workers report high morale (likely correlated with proximity to product). The "Quality Assurance Department" is a chair and a glass. Both are well-used.',
    decay:
      'The Vodka Plant is leaking. Fortunately, local wildlife has gathered to assist with cleanup. Unfortunately, local wildlife is now drunk. A bear was seen operating a forklift. No one intervened.',
    destruction:
      'The Vodka Plant has been closed. A moment of silence is observed. The moment lasts three days. Productivity across the city drops 40%. Citizens develop a sudden interest in fermentation chemistry.',
  },

  // -- Gulag ---
  gulag: {
    placement:
      'A Corrective Labor Facility has been established. It is not a prison. It is a "voluntary attitude adjustment center." The barbed wire is decorative. The guard towers are for birdwatching. The searchlights are mood lighting.',
    inspection:
      'INSPECTION REPORT: Capacity: 200. Current occupancy: 347. Inmate satisfaction: not applicable (satisfaction is a privilege, not a right). Rehabilitation rate: 100%. Recidivism rate: also 100%. These numbers are not contradictory. They are dialectical.',
    decay:
      'The Gulag fences are deteriorating. This is not a security concern because no one wants to escape into the surrounding frozen wasteland. The wasteland, for its part, does not want them either. An equilibrium has been reached.',
    destruction:
      'The Gulag has been decommissioned. Its inmates have been released into society. Society was not warned. The former inmates report that freedom feels "similar but with longer bread lines."',
  },

  // -- Road ---
  road: {
    placement:
      'A road has been laid. "Laid" is a generous description. It is more of a suggestion of where vehicles might go, expressed in gravel and mild optimism. The potholes are pre-installed for your convenience.',
    inspection:
      'INSPECTION REPORT: Surface quality: theoretical. Lane markings: absent (lanes are a capitalist concept; Soviet drivers share the road through collective intuition). Potholes per kilometer: 47. Each pothole has been assigned a name and a file.',
    decay:
      'The road has developed what engineers call "character" and what drivers call "a hazard." The potholes have merged into a single, continuous pothole. Technically, the road is now a canal. Boats have been requisitioned.',
    destruction:
      'The road has been removed. The mud beneath is exposed. Citizens report that the mud offers comparable traction. Several potholes remain as a memorial.',
  },

  // -- School ---
  school: {
    placement:
      'A School has been constructed. Young comrades will learn the three essential subjects: History (approved version), Mathematics (statistics only, for quota reports), and Loyalty (advanced placement available).',
    inspection:
      'INSPECTION REPORT: Students: attentive (the alternative is not discussed). Textbooks: current edition (all previous editions have been burned, as is tradition when history is updated). The school play this year is "The Tractor: A Love Story." Attendance is mandatory. Critics rate it: also mandatory.',
    decay:
      'The school roof leaks during lessons. Teachers have incorporated this into the curriculum as "applied meteorology." Students now learn in raincoats. This is called "immersive education."',
    destruction:
      'The School has been demolished. Education continues informally via the State Radio. Citizens learn by repetition. The anthem counts as a music class.',
  },

  // -- Hospital ---
  hospital: {
    placement:
      'A Hospital opens its doors. Equipment: mostly present. Medicine: occasionally present. Doctors: ideologically present. Patients are reminded that Soviet medicine cures through the power of optimism and a vigorous filing system.',
    inspection:
      'INSPECTION REPORT: Beds: 50. Patients: 120. Beds per patient: a fraction that the hospital prefers not to calculate. The pharmacy stocks two medications: aspirin and vodka. For serious cases, both are administered simultaneously.',
    decay:
      'The Hospital is experiencing "structural wellness challenges." The X-ray machine now only displays pictures of Lenin. Doctors report this has not reduced diagnostic accuracy.',
    destruction:
      'The Hospital has been demolished. Citizens are advised to simply not become ill. Preventive medicine at its most efficient.',
  },

  // -- Barracks ---
  barracks: {
    placement:
      'Military Barracks erected. Soldiers will sleep here in shifts, eat here in shifts, and contemplate existence here in shifts. The beds are concrete. This builds character. The character is mostly back pain.',
    inspection:
      'INSPECTION REPORT: Troops: present and accounted for. Morale: classified. Rations: "adequate" (a word that has been doing heavy lifting since 1922). The armory contains 40 rifles and one instruction manual. The manual is in a language no one recognizes.',
    decay:
      'The Barracks are showing wear. Soldiers report that the concrete beds have become "softer" through erosion. This is celebrated as the first improvement to military housing in 30 years.',
    destruction:
      'The Barracks have been dismantled. Soldiers reassigned to sleep outdoors. They report the ground is comparable to the beds they had. Morale: unchanged (still classified).',
  },

  // -- Radio Station ---
  radio_station: {
    placement:
      'A Radio Station begins broadcasting. Content: the anthem (on repeat), the weather (always grey), and the news (always good). Listeners have three channels to choose from. All three channels play the same thing. Choice is an illusion, but a comforting one.',
    inspection:
      'INSPECTION REPORT: Broadcast range: 50 kilometers. Signal clarity: adequate. Content variety: one. The DJ has been playing the same playlist since 1978. He has not been asked to change it. He has not asked to change it. The system works.',
    decay:
      'The Radio Station antenna is tilting. Broadcasts now reach only the eastern half of the city. Western-half citizens report enjoying the silence. This has been noted in their files.',
    destruction:
      'The Radio Station has gone silent. For the first time in decades, citizens can hear themselves think. Several report the experience as "unsettling." The silence is temporary. It is always temporary.',
  },

  // -- Ministry Building ---
  ministry: {
    placement:
      'A Ministry Building rises, a monument to bureaucratic ambition. It has 47 departments, 200 offices, and one pencil sharpener. The pencil sharpener has a waiting list.',
    inspection:
      'INSPECTION REPORT: Forms processed per day: 3. Forms generated per day: 47. Net form accumulation: positive and accelerating. The building has more filing cabinets than people. The filing cabinets have better working conditions.',
    decay:
      'The Ministry Building is sinking into its own paperwork. The basement, once an archive, is now a paper mine. Archaeologists have discovered forms from 1953 still awaiting approval.',
    destruction:
      'The Ministry Building has been demolished. 4,000 tons of paperwork released into the atmosphere. Citizens downwind report paper cuts from breathing. The forms, freed from their cabinets, scatter across the city like bureaucratic confetti.',
  },

  // -- Lenin Statue ---
  lenin_statue: {
    placement:
      'A Lenin Statue has been erected. It points toward the future. Or possibly toward the bread line. The direction is inspirational either way. Pigeons gather immediately. They, too, are inspired.',
    inspection:
      'INSPECTION REPORT: Structural integrity: eternal (by decree). The statue points northeast. Previous statue pointed northwest. Citizens who noticed the discrepancy have been reassigned. Bird droppings: present. The droppings have been classified as "natural patina."',
    decay:
      'The Lenin Statue is developing a lean. It now points slightly downward, which citizens interpret as Lenin looking at the people he served. Engineers interpret it as a foundation problem. Both interpretations are, technically, correct.',
    destruction:
      'The Lenin Statue has been... removed. This is not a political statement. It is "infrastructure optimization." A new, larger Lenin Statue has been ordered. Estimated arrival: the next Five-Year Plan.',
  },

  // -- Cultural Palace ---
  cultural_palace: {
    placement:
      'A Cultural Palace opens, dedicated to the enrichment of the proletarian soul. Offerings include: mandatory ballet, compulsory poetry, and an exhibit of paintings (all depicting tractors). Admission is free. Attendance is not optional.',
    inspection:
      'INSPECTION REPORT: Current exhibition: "500 Shades of Grey: Soviet Concrete Through the Ages." Attendance this month: 3,000 (mandatory capacity: 3,000). The gift shop sells postcards of the building. The postcards look better than the building. This is not discussed.',
    decay:
      'The Cultural Palace chandeliers have fallen. The cultural programming continues by candlelight. Critics call it "atmospheric." The audience calls it "dark." Both are correct. The darkness is cultural.',
    destruction:
      'The Cultural Palace has been demolished. Culture has been temporarily suspended. Citizens are advised to find enrichment in their labor. This was always the backup plan.',
  },

  // -- Factory ---
  factory: {
    placement:
      'A Factory springs into operation, producing goods that the city needs, or possibly goods that no one needs but the quota demands. The assembly line hums with purpose. The purpose is unclear, but the humming is consistent.',
    inspection:
      "INSPECTION REPORT: Output: 400 units. Units of what: classified. Quality: acceptable by standards that were revised 11 minutes ago. The assembly line produces items at a rate of one every 45 seconds. What happens to these items after production is someone else's department.",
    decay:
      'The Factory machinery is producing sounds not found in any engineering manual. Workers describe the noise as "the machine screaming." Engineers describe it as "operational feedback." The machine describes nothing. It is a machine. But it is screaming.',
    destruction:
      'The Factory has been flattened. The machines are silent. The workers, standing in the rubble, experience a brief moment of quiet reflection before being assigned to another factory. The other factory is identical. Everything is identical.',
  },

  // -- Railway Station ---
  railway_station: {
    placement:
      'A Railway Station is built, connecting this city to other cities that may or may not exist. The train schedule has been posted. It is optimistic. The trains are less so.',
    inspection:
      'INSPECTION REPORT: Trains scheduled today: 4. Trains arrived today: 1. Train that arrived: wrong train. The station buffet offers tea (grey), sandwiches (grey), and an atmosphere (also grey). The departures board lists destinations. The destinations list reads: "classified."',
    decay:
      'The Railway Station platform is crumbling. Passengers are advised to board quickly, as the platform may not exist by the time the train arrives. The train may also not exist. Time itself is under review.',
    destruction:
      'The Railway Station has been demolished. The last train departed for an unknown destination with 14 passengers who were unaware the station was being demolished. They will arrive somewhere. Probably.',
  },

  // -- Bunker ---
  bunker: {
    placement:
      'A Bunker has been excavated beneath the city. It will protect key personnel in the event of capitalist aggression. Key personnel includes: 1 official, his family, 400 filing cabinets, and a portrait of Lenin. Citizens are not key personnel.',
    inspection:
      'INSPECTION REPORT: Depth: 30 meters. Supplies: 5 years of canned meat (expiration date: 1974). Air filtration: operational. The bunker includes a conference room for post-apocalyptic planning. The agenda has been pre-written. Item 1: "Blame the West." Item 2: "See Item 1."',
    decay:
      'The Bunker is flooding. Engineers call it "accidental water storage." The canned meat is now floating. The portrait of Lenin remains above water. It always does.',
    destruction:
      'The Bunker has been filled with concrete. This is either decommissioning or construction. In Soviet engineering, the difference is academic.',
  },
};

/** Returns the building flavor text for a given building type key. */
export function getBuildingFlavor(type: string): BuildingFlavorText | null {
  return BUILDING_FLAVOR[type] ?? null;
}
