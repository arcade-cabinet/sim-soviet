/**
 * @fileoverview Procedural Russian Name Generator for SimSoviet 2000.
 *
 * Generates endless unique leader names for the Politburo, KGB, ministries,
 * and various Soviet bureaucratic organs. Names follow authentic Russian
 * naming conventions: Given Name + Patronymic + Surname.
 *
 * ## Russian Naming Conventions
 *
 * Every Russian has three name components:
 *
 * 1. **Given name** (imia): the personal first name.
 *
 * 2. **Patronymic** (otchestvo): derived from the father's given name.
 *    - Male: father's name + "-ovich" / "-evich"
 *      - After hard consonants or vowels: -ovich (Ivan -> Ivanovich)
 *      - After soft consonants, -j, or sibilants: -evich (Sergei -> Sergeevich)
 *      - Special cases: Ilya -> Ilyich, Lev -> Lvovich, Pavel -> Pavlovich
 *    - Female: father's name + "-ovna" / "-evna"
 *      - After hard consonants or vowels: -ovna (Ivan -> Ivanovna)
 *      - After soft consonants, -j, or sibilants: -evna (Sergei -> Sergeevna)
 *      - Special cases: Ilya -> Ilyinichna, Lev -> Lvovna, Pavel -> Pavlovna
 *
 * 3. **Surname** (familiia): the family name.
 *    - Most Russian surnames have gender forms:
 *      Male: Ivanov, Female: Ivanova (-a suffix)
 *    - Georgian surnames (-shvili, -dze, -ia) do not change by gender.
 *    - Ukrainian surnames (-enko, -chuk) do not change by gender.
 *    - Central Asian surnames typically do not change by gender.
 *
 * ## Combinatorial Capacity
 *
 * With 80 male given names, 40 female given names, 80 patronymic fathers,
 * and 200+ surnames, this system can produce:
 * - Male:   80 x 80 x 200 = 1,280,000 unique combinations
 * - Female: 40 x 80 x 200 =   640,000 unique combinations
 * - With titles: multiply by ~50 positions
 * - With epithets: multiply by ~80 epithets
 * - Total unique named leaders: effectively unlimited
 */

// ─────────────────────────────────────────────────────────
//  MALE GIVEN NAMES (imia)
//
//  Common Soviet-era Russian, Ukrainian, Georgian, and
//  Central Asian names. 80 entries.
// ─────────────────────────────────────────────────────────

export const MALE_GIVEN_NAMES: readonly string[] = [
  // Classic Russian
  'Aleksandr',
  'Aleksei',
  'Anatoli',
  'Andrei',
  'Anton',
  'Arkadi',
  'Artem',
  'Boris',
  'Daniil',
  'Denis',
  'Dmitri',
  'Eduard',
  'Evgeni',
  'Fedor',
  'Filipp',
  'Gavriil',
  'Gennadii',
  'Georgi',
  'Grigori',
  'Igor',
  'Ilya',
  'Ivan',
  'Kirill',
  'Kliment',
  'Konstantin',
  'Lavrentii',
  'Leonid',
  'Lev',
  'Maksim',
  'Matvei',
  'Mikhail',
  'Nikolai',
  'Oleg',
  'Pavel',
  'Petr',
  'Roman',
  'Ruslan',
  'Semyon',
  'Sergei',
  'Stanislav',
  'Stepan',
  'Svyatoslav',
  'Timofei',
  'Timur',
  'Valentin',
  'Valeri',
  'Vasili',
  'Viktor',
  'Vitali',
  'Vladimir',
  'Vladislav',
  'Vyacheslav',
  'Yakov',
  'Yegor',
  'Yevgeni',
  'Yuri',
  // Ukrainian
  'Bogdan',
  'Danylo',
  'Mykola',
  'Oleksandr',
  'Ostap',
  'Petro',
  'Taras',
  // Georgian
  'Avtandil',
  'Givi',
  'Irakli',
  'Levan',
  'Nodar',
  'Shalva',
  'Shota',
  'Tengiz',
  'Vakhtang',
  'Zurab',
  // Central Asian
  'Alisher',
  'Bakhtiyar',
  'Dinmukhamed',
  'Mukhtar',
  'Nursultan',
  'Rashid',
  'Rustam',
  'Sharaf',
] as const;

// ─────────────────────────────────────────────────────────
//  FEMALE GIVEN NAMES (imia)
//
//  Common Soviet-era women's names. 40 entries.
// ─────────────────────────────────────────────────────────

export const FEMALE_GIVEN_NAMES: readonly string[] = [
  'Aleksandra',
  'Anastasia',
  'Anna',
  'Daria',
  'Ekaterina',
  'Elena',
  'Elizaveta',
  'Evgenia',
  'Galina',
  'Irina',
  'Klavdia',
  'Kristina',
  'Larisa',
  'Lidia',
  'Liudmila',
  'Maria',
  'Marina',
  'Nadezhda',
  'Natalia',
  'Nina',
  'Oksana',
  'Olga',
  'Polina',
  'Raisa',
  'Sofia',
  'Svetlana',
  'Tamara',
  'Tatiana',
  'Valentina',
  'Varvara',
  'Vera',
  'Veronika',
  'Viktoria',
  'Yelena',
  'Yulia',
  'Zhenya',
  'Zinaida',
  'Zoya',
  // Georgian / Central Asian
  'Gulnara',
  'Nino',
] as const;

// ─────────────────────────────────────────────────────────
//  PATRONYMIC SYSTEM
//
//  Patronymics are formed from the father's given name.
//  We use a lookup of father names -> patronymic stems.
//  Special irregular forms are handled explicitly; regular
//  forms follow the -ovich/-evich (male) and -ovna/-evna
//  (female) pattern.
// ─────────────────────────────────────────────────────────

/**
 * Maps a father's given name to the patronymic stem.
 * The stem has male/female suffixes appended at generation time.
 *
 * If a name is not in this map, we fall back to algorithmic rules:
 * - Names ending in a consonant: name + "ovich" / "ovna"
 * - Names ending in "i" or "ei": drop trailing vowel(s) + "evich" / "evna"
 * - Names ending in "a": drop "a" + "ovich" / "ovna"
 */
interface PatronymicEntry {
  /** Stem for male patronymic (add nothing -- it's the full form) */
  male: string;
  /** Stem for female patronymic (add nothing -- it's the full form) */
  female: string;
}

/**
 * Irregular / notable patronymic forms that don't follow simple rules.
 * These are keyed by the father's given name.
 */
const IRREGULAR_PATRONYMICS: Readonly<Record<string, PatronymicEntry>> = {
  Ilya: { male: 'Ilyich', female: 'Ilyinichna' },
  Lev: { male: 'Lvovich', female: 'Lvovna' },
  Pavel: { male: 'Pavlovich', female: 'Pavlovna' },
  Petr: { male: 'Petrovich', female: 'Petrovna' },
  Fedor: { male: 'Fedorovich', female: 'Fedorovna' },
  Yakov: { male: 'Yakovlevich', female: 'Yakovlevna' },
  Gavriil: { male: 'Gavrilovich', female: 'Gavrilovna' },
  Daniil: { male: 'Danilovich', female: 'Danilovna' },
  Matvei: { male: 'Matveevich', female: 'Matveevna' },
  Andrei: { male: 'Andreevich', female: 'Andreevna' },
  Sergei: { male: 'Sergeevich', female: 'Sergeevna' },
  Aleksei: { male: 'Alekseevich', female: 'Alekseevna' },
  Timofei: { male: 'Timofeevich', female: 'Timofeevna' },
  Evgeni: { male: 'Evgenievich', female: 'Evgenievna' },
  Yevgeni: { male: 'Yevgenievich', female: 'Yevgenievna' },
  Valeri: { male: 'Valerievich', female: 'Valerievna' },
  Vitali: { male: 'Vitalievich', female: 'Vitalievna' },
  Gennadii: { male: 'Gennadievich', female: 'Gennadievna' },
  Vasili: { male: 'Vasilievich', female: 'Vasilievna' },
  Arkadi: { male: 'Arkadievich', female: 'Arkadievna' },
  Anatoli: { male: 'Anatolievich', female: 'Anatolievna' },
  Dmitri: { male: 'Dmitrievich', female: 'Dmitrievna' },
  Georgi: { male: 'Georgievich', female: 'Georgievna' },
  Grigori: { male: 'Grigorievich', female: 'Grigorievna' },
  Yuri: { male: 'Yurievich', female: 'Yurievna' },
};

/**
 * The pool of father names used to generate patronymics.
 * This is separate from the given-name pools because patronymics reference
 * the previous generation, and we want variety without coupling the two.
 */
export const PATRONYMIC_FATHER_NAMES: readonly string[] = [
  'Aleksandr',
  'Aleksei',
  'Anatoli',
  'Andrei',
  'Anton',
  'Arkadi',
  'Boris',
  'Daniil',
  'Denis',
  'Dmitri',
  'Eduard',
  'Evgeni',
  'Fedor',
  'Filipp',
  'Gavriil',
  'Gennadii',
  'Georgi',
  'Grigori',
  'Igor',
  'Ilya',
  'Ivan',
  'Kirill',
  'Kliment',
  'Konstantin',
  'Lavrentii',
  'Leonid',
  'Lev',
  'Maksim',
  'Matvei',
  'Mikhail',
  'Nikolai',
  'Oleg',
  'Pavel',
  'Petr',
  'Roman',
  'Semyon',
  'Sergei',
  'Stanislav',
  'Stepan',
  'Svyatoslav',
  'Timofei',
  'Timur',
  'Valentin',
  'Valeri',
  'Vasili',
  'Viktor',
  'Vitali',
  'Vladimir',
  'Vladislav',
  'Vyacheslav',
  'Yakov',
  'Yegor',
  'Yevgeni',
  'Yuri',
  // Include a few Ukrainian / Georgian fathers for patronymic variety
  'Bogdan',
  'Mykola',
  'Oleksandr',
  'Petro',
  'Taras',
  'Levan',
  'Shota',
  'Tengiz',
  'Vakhtang',
  'Zurab',
  'Rustam',
  'Mukhtar',
  'Alisher',
  'Rashid',
  'Nursultan',
  'Bakhtiyar',
  'Dinmukhamed',
  'Sharaf',
  // Extra classic Russian fathers for density
  'Afanasi',
  'Ermolai',
  'Innokenti',
  'Nikifor',
  'Prokhor',
  'Trofim',
  'Tikhon',
  'Saveli',
  'Platon',
  'Kondrati',
] as const;

// ─────────────────────────────────────────────────────────
//  PATRONYMIC GENERATION RULES
// ─────────────────────────────────────────────────────────

export const PATRONYMIC_RULES = {
  /**
   * Generate a patronymic from a father's given name.
   *
   * @param fatherName - The father's given name (e.g. "Ivan", "Sergei").
   * @param gender - 'male' or 'female' for the person receiving the patronymic.
   * @returns The patronymic string (e.g. "Ivanovich", "Sergeevna").
   */
  generate(fatherName: string, gender: 'male' | 'female'): string {
    // Check irregular forms first
    const irregular = IRREGULAR_PATRONYMICS[fatherName];
    if (irregular) {
      return irregular[gender];
    }

    // Algorithmic fallback
    const name = fatherName;
    const lastChar = name.slice(-1).toLowerCase();
    const lastTwo = name.slice(-2).toLowerCase();

    // Names ending in soft-sign-like "i" or "ii"
    if (lastTwo === 'ii' || lastTwo === 'iy') {
      const stem = name.slice(0, -2);
      return gender === 'male' ? `${stem}ievich` : `${stem}ievna`;
    }

    if (lastChar === 'i') {
      const stem = name.slice(0, -1);
      return gender === 'male' ? `${stem}ievich` : `${stem}ievna`;
    }

    // Names ending in "a" (Ilya handled in irregulars)
    if (lastChar === 'a') {
      const stem = name.slice(0, -1);
      return gender === 'male' ? `${stem}ovich` : `${stem}ovna`;
    }

    // Names ending in "ei" (Sergei, Aleksei handled in irregulars, but fallback)
    if (lastTwo === 'ei') {
      const stem = name.slice(0, -2);
      return gender === 'male' ? `${stem}eevich` : `${stem}eevna`;
    }

    // Default: consonant ending
    return gender === 'male' ? `${name}ovich` : `${name}ovna`;
  },
} as const;

// ─────────────────────────────────────────────────────────
//  SURNAMES (familiia)
//
//  200+ surnames spanning Russian, Ukrainian, Belarusian,
//  Georgian, Armenian, Central Asian, and Baltic origins.
//  Includes famous/infamous Soviet-era names for satire.
// ─────────────────────────────────────────────────────────

/**
 * Surname entry. Some surnames change form by gender (most Russian -ov/-ev/-in
 * surnames add -a for female), while others (Georgian, Ukrainian -enko, etc.)
 * remain the same.
 */
interface SurnameEntry {
  /** Male form of the surname */
  male: string;
  /** Female form (null = same as male) */
  female: string | null;
}

const SURNAMES_RAW: readonly SurnameEntry[] = [
  // ── Common Russian (-ov / -ev / -in / -yn) ──────────
  { male: 'Ivanov', female: 'Ivanova' },
  { male: 'Petrov', female: 'Petrova' },
  { male: 'Sidorov', female: 'Sidorova' },
  { male: 'Smirnov', female: 'Smirnova' },
  { male: 'Kuznetsov', female: 'Kuznetsova' },
  { male: 'Popov', female: 'Popova' },
  { male: 'Sokolov', female: 'Sokolova' },
  { male: 'Lebedev', female: 'Lebedeva' },
  { male: 'Kozlov', female: 'Kozlova' },
  { male: 'Novikov', female: 'Novikova' },
  { male: 'Morozov', female: 'Morozova' },
  { male: 'Volkov', female: 'Volkova' },
  { male: 'Alekseev', female: 'Alekseeva' },
  { male: 'Fedorov', female: 'Fedorova' },
  { male: 'Orlov', female: 'Orlova' },
  { male: 'Andreev', female: 'Andreeva' },
  { male: 'Makarov', female: 'Makarova' },
  { male: 'Nikolaev', female: 'Nikolaeva' },
  { male: 'Markov', female: 'Markova' },
  { male: 'Voronov', female: 'Voronova' },
  { male: 'Menshikov', female: 'Menshikova' },
  { male: 'Pavlov', female: 'Pavlova' },
  { male: 'Sorokin', female: 'Sorokina' },
  { male: 'Baranov', female: 'Baranova' },
  { male: 'Vlasov', female: 'Vlasova' },
  { male: 'Komarov', female: 'Komarova' },
  { male: 'Frolov', female: 'Frolova' },
  { male: 'Gusev', female: 'Guseva' },
  { male: 'Karpov', female: 'Karpova' },
  { male: 'Titov', female: 'Titova' },
  { male: 'Belov', female: 'Belova' },
  { male: 'Davydov', female: 'Davydova' },
  { male: 'Tarasov', female: 'Tarasova' },
  { male: 'Egorov', female: 'Egorova' },
  { male: 'Belyakov', female: 'Belyakova' },
  { male: 'Medvedev', female: 'Medvedeva' },
  { male: 'Ershov', female: 'Ershova' },
  { male: 'Nikitin', female: 'Nikitina' },
  { male: 'Sobolev', female: 'Soboleva' },
  { male: 'Ryabov', female: 'Ryabova' },
  { male: 'Polyakov', female: 'Polyakova' },
  { male: 'Tsvetkov', female: 'Tsvetkova' },
  { male: 'Krasilnikov', female: 'Krasilnikova' },
  { male: 'Zubarev', female: 'Zubareva' },
  { male: 'Galkin', female: 'Galkina' },
  { male: 'Vinogradov', female: 'Vinogradova' },
  { male: 'Gromov', female: 'Gromova' },
  { male: 'Zhukov', female: 'Zhukova' },
  { male: 'Denisov', female: 'Denisova' },
  { male: 'Kovalev', female: 'Kovaleva' },
  { male: 'Ilyin', female: 'Ilyina' },
  { male: 'Gorbunov', female: 'Gorbunova' },
  { male: 'Kudryavtsev', female: 'Kudryavtseva' },
  { male: 'Kalashnikov', female: 'Kalashnikova' },
  { male: 'Bykov', female: 'Bykova' },
  { male: 'Muravyov', female: 'Muravyova' },
  { male: 'Romanov', female: 'Romanova' },
  { male: 'Osipov', female: 'Osipova' },
  { male: 'Kiselev', female: 'Kiseleva' },
  { male: 'Korolev', female: 'Koroleva' },
  { male: 'Gerasimov', female: 'Gerasimova' },
  { male: 'Ponomarev', female: 'Ponomareva' },
  { male: 'Lazarev', female: 'Lazareva' },
  { male: 'Kulikov', female: 'Kulikova' },
  { male: 'Semenov', female: 'Semenova' },
  { male: 'Safonov', female: 'Safonova' },
  { male: 'Zakharov', female: 'Zakharova' },
  { male: 'Chesnokov', female: 'Chesnokova' },
  { male: 'Zolotov', female: 'Zolotova' },
  { male: 'Suslov', female: 'Suslova' },
  { male: 'Grishin', female: 'Grishina' },
  { male: 'Borisov', female: 'Borisova' },
  { male: 'Tikhonov', female: 'Tikhonova' },
  { male: 'Ustinov', female: 'Ustinova' },
  { male: 'Ryzhkov', female: 'Ryzhkova' },
  { male: 'Chernov', female: 'Chernova' },
  { male: 'Vorontsov', female: 'Vorontsova' },
  { male: 'Bogdanov', female: 'Bogdanova' },
  { male: 'Lobanov', female: 'Lobanova' },
  { male: 'Ignatov', female: 'Ignatova' },
  { male: 'Luzhkov', female: 'Luzhkova' },

  // ── Russian -ski / -skii ─────────────────────────────
  { male: 'Dzerzhinski', female: 'Dzerzhinskaya' },
  { male: 'Brezhnev', female: 'Brezhneva' },
  { male: 'Podgorny', female: 'Podgornaya' },
  { male: 'Chernenko', female: null },
  { male: 'Andropov', female: 'Andropova' },
  { male: 'Kosygin', female: 'Kosygina' },
  { male: 'Malenkov', female: 'Malenkova' },
  { male: 'Molotov', female: 'Molotova' },
  { male: 'Bulganin', female: 'Bulganina' },
  { male: 'Kaganovich', female: null },
  { male: 'Mikoyan', female: null },
  { male: 'Voroshilov', female: 'Voroshilova' },
  { male: 'Kalinin', female: 'Kalinina' },
  { male: 'Kirov', female: 'Kirova' },
  { male: 'Tukhachevski', female: 'Tukhachevskaya' },
  { male: 'Budyonny', female: 'Budyonnaya' },
  { male: 'Zhdanov', female: 'Zhdanova' },
  { male: 'Kuibyshev', female: 'Kuibysheva' },
  { male: 'Ordzhonikidzev', female: 'Ordzhonikidzeva' },

  // ── Ukrainian ────────────────────────────────────────
  { male: 'Khrushchyov', female: 'Khrushchyova' },
  { male: 'Kravchenko', female: null },
  { male: 'Bondarenko', female: null },
  { male: 'Shevchenko', female: null },
  { male: 'Kovalenko', female: null },
  { male: 'Tkachenko', female: null },
  { male: 'Boyko', female: null },
  { male: 'Polishchuk', female: null },
  { male: 'Goncharuk', female: null },
  { male: 'Mazurchuk', female: null },
  { male: 'Petrenko', female: null },
  { male: 'Lysenko', female: null },
  { male: 'Timoshenko', female: null },
  { male: 'Ponomarenko', female: null },
  { male: 'Grushevski', female: 'Grushevskaya' },

  // ── Belarusian ───────────────────────────────────────
  { male: 'Masherov', female: 'Masherova' },
  { male: 'Lukashevich', female: null },
  { male: 'Mazurov', female: 'Mazurova' },
  { male: 'Kiselenko', female: null },

  // ── Georgian ─────────────────────────────────────────
  { male: 'Dzhugashvili', female: null },
  { male: 'Shevardnadze', female: null },
  { male: 'Beria', female: null },
  { male: 'Ordzhonikidze', female: null },
  { male: 'Tsereteli', female: null },
  { male: 'Chavchavadze', female: null },
  { male: 'Makharadze', female: null },
  { male: 'Baratashvili', female: null },
  { male: 'Lomidze', female: null },
  { male: 'Gurgenidze', female: null },
  { male: 'Kipiani', female: null },
  { male: 'Datashvili', female: null },
  { male: 'Jughashvili', female: null },

  // ── Armenian ─────────────────────────────────────────
  { male: 'Hovhannisyan', female: null },
  { male: 'Petrosyan', female: null },
  { male: 'Arutiunyan', female: null },
  { male: 'Grigoryan', female: null },
  { male: 'Khachaturyan', female: null },
  { male: 'Sargsyan', female: null },
  { male: 'Hakobyan', female: null },
  { male: 'Gevorkyan', female: null },

  // ── Azerbaijani ──────────────────────────────────────
  { male: 'Aliyev', female: 'Aliyeva' },
  { male: 'Bagirov', female: 'Bagirova' },
  { male: 'Huseinov', female: 'Huseinova' },
  { male: 'Mamedov', female: 'Mamedova' },
  { male: 'Narimanov', female: 'Narimanova' },

  // ── Central Asian (Kazakh, Uzbek, Turkmen, etc.) ────
  { male: 'Kunaev', female: 'Kunaeva' },
  { male: 'Nazarbaev', female: 'Nazarbaeva' },
  { male: 'Karimov', female: 'Karimova' },
  { male: 'Rashidov', female: 'Rashidova' },
  { male: 'Niyazov', female: 'Niyazova' },
  { male: 'Rakhmonov', female: 'Rakhmonova' },
  { male: 'Akaev', female: 'Akaeva' },
  { male: 'Usmankhodzhaev', female: 'Usmankhodzhaeva' },
  { male: 'Turgunov', female: 'Turgunova' },
  { male: 'Sultanov', female: 'Sultanova' },
  { male: 'Abdullaev', female: 'Abdullaeva' },

  // ── Baltic ───────────────────────────────────────────
  { male: 'Voss', female: null },
  { male: 'Pelsche', female: null },
  { male: 'Snieckus', female: null },

  // ── Satirical / compound / rare ──────────────────────
  { male: 'Zheleznov', female: 'Zheleznova' }, // "iron"
  { male: 'Stakhanov', female: 'Stakhanova' }, // the famous overachiever
  { male: 'Betonov', female: 'Betonova' }, // "concrete"
  { male: 'Tankevich', female: null }, // "tank"
  { male: 'Traktorov', female: 'Traktorova' }, // "tractor"
  { male: 'Kolkhoznikov', female: 'Kolkhoznikova' }, // "collective farmer"
  { male: 'Propagandov', female: 'Propagandova' }, // "propaganda"
  { male: 'Planovoi', female: 'Planovaya' }, // "planned"
  { male: 'Subbotnikov', female: 'Subbotnikova' }, // "Saturday worker"
  { male: 'Piatiletkin', female: 'Piatiletlkina' }, // "five-year-plan"
  { male: 'Ocherednov', female: 'Ocherednova' }, // "queue-related"
  { male: 'Kvotnikov', female: 'Kvotnikova' }, // "quota"
  { male: 'Sputnikov', female: 'Sputnikova' }, // "satellite"
  { male: 'Kosmonautov', female: 'Kosmonautova' }, // "cosmonaut"
] as const;

/** Flat array of male surnames for quick access */
export const SURNAMES_MALE: readonly string[] = SURNAMES_RAW.map((s) => s.male);

/** Flat array of female surnames for quick access */
export const SURNAMES_FEMALE: readonly string[] = SURNAMES_RAW.map((s) => s.female ?? s.male);

/**
 * Get the gendered form of a surname by index.
 * @param index - Index into SURNAMES_RAW.
 * @param gender - 'male' or 'female'.
 * @returns The appropriate gendered surname.
 */
export function getSurname(index: number, gender: 'male' | 'female'): string {
  const entry = SURNAMES_RAW[index % SURNAMES_RAW.length]!;
  if (gender === 'female') {
    return entry.female ?? entry.male;
  }
  return entry.male;
}

// ─────────────────────────────────────────────────────────
//  TITLES AND POSITIONS
//
//  Soviet bureaucratic titles and positions. Organized by
//  institution for use in leader assignment. The {CITY}
//  placeholder is replaced at generation time.
// ─────────────────────────────────────────────────────────

export type TitleCategory = 'party' | 'state' | 'security' | 'military' | 'ministry' | 'local';

export const TITLES: Readonly<Record<TitleCategory, readonly string[]>> = {
  party: [
    'General Secretary of the Communist Party',
    'First Secretary of the Central Committee',
    'Second Secretary of the Central Committee',
    'Secretary of the Central Committee for Ideology',
    'Secretary of the Central Committee for Agriculture',
    'Secretary of the Central Committee for Heavy Industry',
    'First Secretary of the {CITY} Oblast Committee',
    'First Secretary of the {CITY} City Committee',
    'Chairman of the Party Control Commission',
    'Head of the Department of Agitation and Propaganda',
    'Head of the Organizational Department',
    'Head of the Administrative Organs Department',
    'Candidate Member of the Politburo',
    'Full Member of the Politburo',
  ],
  state: [
    'Chairman of the Presidium of the Supreme Soviet',
    'Chairman of the Council of Ministers',
    'First Deputy Chairman of the Council of Ministers',
    'Deputy Chairman of the Council of Ministers',
    'Chairman of the State Planning Committee (Gosplan)',
    'Chairman of the State Committee for Science and Technology',
    'Chairman of the State Committee for Construction (Gosstroy)',
    'Chairman of the State Committee for Material-Technical Supply (Gossnab)',
    'Chairman of the State Committee for Prices (Goskomtsen)',
    'Chairman of the State Committee for Labor and Social Questions',
    'Chairman of the State Committee for Standards (Gosstandart)',
    "Chairman of the People's Control Committee",
    'Procurator General of the USSR',
    'Chairman of the Supreme Court of the USSR',
  ],
  security: [
    'Chairman of the Committee for State Security (KGB)',
    'First Deputy Chairman of the KGB',
    'Head of the First Chief Directorate (Foreign Intelligence)',
    'Head of the Second Chief Directorate (Counterintelligence)',
    'Head of the Fifth Chief Directorate (Ideological Counterintelligence)',
    'Head of the Border Troops Directorate',
    'Head of the Seventh Directorate (Surveillance)',
    'Head of the Ninth Directorate (Protection of Leaders)',
    'Head of the {CITY} KGB Directorate',
    'Minister of Internal Affairs (MVD)',
    'Head of the Chief Directorate of Corrective Labor Camps (GULAG)',
    'Commissar for Internal Security',
  ],
  military: [
    'Minister of Defense',
    'Chief of the General Staff',
    'Commander-in-Chief of the Ground Forces',
    'Commander-in-Chief of the Air Force',
    'Commander-in-Chief of the Navy',
    'Commander of the Strategic Rocket Forces',
    'Commander of the {CITY} Military District',
    'Marshal of the Soviet Union',
    'Chief of the Main Political Directorate of the Army',
    'Head of the GRU (Military Intelligence)',
  ],
  ministry: [
    'Minister of Agriculture',
    'Minister of Heavy Industry',
    'Minister of Light Industry',
    'Minister of the Food Industry',
    'Minister of Culture',
    'Minister of Education',
    'Minister of Health',
    'Minister of Foreign Affairs',
    'Minister of Finance',
    'Minister of Communications',
    'Minister of Transport',
    'Minister of the Coal Industry',
    'Minister of the Petroleum Industry',
    'Minister of Ferrous Metallurgy',
    'Minister of Non-Ferrous Metallurgy',
    'Minister of the Chemical Industry',
    'Minister of Machine Building',
    'Minister of the Electronics Industry',
    'Minister of the Aviation Industry',
    'Minister of Medium Machine Building (Nuclear Weapons)',
    'Minister of the Fish Industry',
    'Minister of Procurement',
    'Minister of Land Reclamation and Water Resources',
  ],
  local: [
    'Chairman of the {CITY} City Soviet',
    'Chairman of the {CITY} Oblast Executive Committee',
    'First Secretary of the {CITY} Komsomol',
    'Director of the {CITY} Collective Farm',
    'Director of the {CITY} Tractor Factory',
    "Director of the {CITY} People's Cultural Palace",
    'Chief Architect of {CITY}',
    'Head of the {CITY} Trade Union Council',
    'Director of the {CITY} Bread Factory No. 2',
    'Chairman of the {CITY} Housing Committee',
    'Director of the {CITY} Vodka Distillery',
    'Chief Sanitary Inspector of {CITY}',
  ],
} as const;

/** Flat array of all titles for quick random selection. */
export const ALL_TITLES: readonly string[] = Object.values(TITLES).flat();

// ─────────────────────────────────────────────────────────
//  EPITHETS / NICKNAMES
//
//  Satirical epithets in the tradition of Soviet leaders'
//  informal monikers. Some reference real historical figures;
//  others are pure game satire.
// ─────────────────────────────────────────────────────────

export const EPITHETS: readonly string[] = [
  // ── Historical references ────────────────────────────
  'The Corn Enthusiast', // Khrushchev's maize obsession
  'The Decorated', // Brezhnev's medal collection
  'The Man of Steel', // Stalin's chosen name
  'The Bald Reformer', // Gorbachev
  'The Iron Felix', // Dzerzhinsky
  'The Gray Cardinal', // Suslov
  'The Mustache', // Stalin again
  'The Architect of Perestroika', // Gorbachev
  'The Mineralny Secretary', // Gorbachev's anti-alcohol campaign

  // ── Personality / appearance ─────────────────────────
  'The Invisible', // never seen in public
  'The Unmovable', // has been in office forever
  'The Eternal', // same as above, more dramatic
  'The Whisperer', // speaks so quietly nobody hears orders
  'The Loud One', // opposite
  'The Eyebrow', // Brezhnev reference
  'The Enormous', // physically large
  'The Compact', // physically small
  'The Gray', // utterly forgettable
  'The Beige', // even more forgettable
  'The Squinter', // always suspicious
  'The Nodder', // agrees with everything
  'The Fist', // aggressive
  'The Handshake', // diplomatic to a fault

  // ── Bureaucratic / political ─────────────────────────
  'The Paperwork', // only produces forms
  'The Rubber Stamp', // approves everything
  'The Filing Cabinet', // knows where everything is buried
  'The Five-Year Planner', // obsessed with quotas
  'The Quota Crusher', // always exceeds targets (on paper)
  'The Report Writer', // produces nothing but reports
  'The Committee Chairman', // chairs seventeen committees
  'The Midnight Signer', // signs decrees at 3am
  'The Reclassifier', // renames problems instead of solving them
  'The Downsizer', // "optimizes" the workforce
  'Friend of the People', // ironic
  "The People's Accountant", // counts everything, produces nothing
  'The Theoretician', // lots of ideas, no implementation
  'The Pragmatist', // no ideas, somehow everything works
  'The Dialectician', // argues with himself and wins

  // ── Competence (satirical) ───────────────────────────
  'The Adequate', // highest praise
  'The Satisfactory', // second-highest praise
  'The Sufficient', // slightly below satisfactory
  'The Present', // physically present, mentally elsewhere
  'The Punctual', // always on time, never useful
  'The Technically Correct', // worst kind of correct
  'The Mostly Harmless', // Douglas Adams in Soviet bureaucracy
  'The Regrettably Competent', // competence is suspicious
  'The Dangerously Effective', // effectiveness is even more suspicious
  'Hero of Bureaucratic Labor', // award for exceptional paperwork
  'The Optimized', // has been "improved" by the system
  'Three-Time Order of Lenin Recipient', // suspiciously decorated

  // ── Ideological ──────────────────────────────────────
  'The True Believer', // genuinely believes propaganda
  'The Correct Thinker', // thoughts have been verified
  'The Orthodox Marxist', // follows the text exactly
  'The Revisionist Hunter', // finds ideological deviation everywhere
  'The Class Warrior', // fights class enemies (real or imagined)
  'The Internationalist', // solidarity with all, friends with none
  'The Anti-Cosmopolitan', // suspicious of anything foreign
  'The Volunteer', // volunteering was mandatory

  // ── Food / resource themed ───────────────────────────
  'The Potato Counter', // agriculture minister
  'The Bread Distributor', // controls the bread line
  'The Vodka Commissar', // oversees essential fluid supplies
  'The Turnip Whisperer', // agricultural mysticism
  'The Calorie Reducer', // euphemism for famine management
  'The Ration Philosopher', // theorizes about optimal hunger
  'The Beet Baron', // sugar beet magnate
  'The Cabbage Strategist', // plans the cabbage harvest like a war

  // ── Infrastructure themed ────────────────────────────
  'The Concrete Poet', // builds exclusively in concrete
  'The Pipeline Dreamer', // projects always in progress
  'The Dam Builder', // one dam; took 30 years
  'Builder of the Future', // future never arrives
  'The Rail Enthusiast', // trains never run on time
  'The Electrifier', // brought power to 3 villages (briefly)

  // ── Paranoia / KGB themed ────────────────────────────
  'The All-Seeing', // KGB surveillance chief
  'The Listener', // wiretap specialist
  'The File Keeper', // knows everyone's secrets
  'The Night Visitor', // KGB house call specialist
  'The Friendly Interrogator', // oxymoron
  'The Shadow', // follows people professionally
  'The Memory Editor', // rewrites history
  'The Unperson Maker', // removes people from photographs
] as const;

// ─────────────────────────────────────────────────────────
//  CITY NAMES (for title placeholders)
// ─────────────────────────────────────────────────────────

export const CITY_NAMES: readonly string[] = [
  'Novosibirsk',
  'Sverdlovsk',
  'Chelyabinsk',
  'Krasnoyarsk',
  'Magnitogorsk',
  'Stalingrad',
  'Leningrad',
  'Kuibyshev',
  'Gorky',
  'Kalinin',
  'Molotov',
  'Kirov',
  'Zhdanov',
  'Voroshilovgrad',
  'Ordzhonikidze',
  'Dnepropetrovsk',
  'Kharkov',
  'Minsk',
  'Tbilisi',
  'Baku',
  'Yerevan',
  'Tashkent',
  'Alma-Ata',
  'Frunze',
  'Dushanbe',
  'Ashkhabad',
  'Riga',
  'Vilnius',
  'Tallinn',
  'Kishinev',
  'Bratsk',
  'Omsk',
  'Tomsk',
  'Irkutsk',
  'Vladivostok',
  'Khabarovsk',
  'Murmansk',
  'Arkhangelsk',
  'Vorkuta',
  'Norilsk',
] as const;

// ─────────────────────────────────────────────────────────
//  GENERATED NAME TYPE
// ─────────────────────────────────────────────────────────

/** A fully generated Soviet leader identity. */
export interface GeneratedLeader {
  /** Given name (imia) */
  givenName: string;
  /** Patronymic (otchestvo) */
  patronymic: string;
  /** Surname (familiia) */
  surname: string;
  /** Gender of the leader */
  gender: 'male' | 'female';
  /** Full formal name: "Surname Given Patronymic" (Russian order) */
  formalName: string;
  /** Western order: "Given Patronymic Surname" */
  westernName: string;
  /** Short form: "G.P. Surname" (initials + surname) */
  shortName: string;
  /** Official title/position */
  title: string;
  /** Satirical epithet/nickname */
  epithet: string;
  /** Full introduction: "Title Surname, 'The Epithet'" */
  introduction: string;
}

// ─────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────

import type { GameRng } from '../game/SeedSystem';

/** Module-level RNG reference, set by NameGenerator constructor */
let _rng: GameRng | null = null;

function pick<T>(arr: readonly T[]): T {
  return _rng ? _rng.pick(arr) : arr[Math.floor(Math.random() * arr.length)]!;
}

function pickIndex(length: number): number {
  return _rng ? _rng.pickIndex(length) : Math.floor(Math.random() * length);
}

// ─────────────────────────────────────────────────────────
//  NAME GENERATOR CLASS
// ─────────────────────────────────────────────────────────

/**
 * Procedural Russian name generator for Soviet leader identities.
 *
 * Tracks previously generated names to avoid exact duplicates within
 * a session. The combinatorial space (~1.9 million unique male names,
 * ~640k female) makes collisions extremely rare.
 *
 * @example
 * ```ts
 * const gen = new NameGenerator();
 * const leader = gen.generate();
 * console.log(leader.introduction);
 * // "Minister of Heavy Industry Volkov, 'The Concrete Poet'"
 *
 * const kgbChief = gen.generate({ gender: 'male', titleCategory: 'security' });
 * console.log(kgbChief.formalName);
 * // "Morozov Ivan Petrovich"
 * ```
 */
export class NameGenerator {
  private generatedKeys = new Set<string>();
  private cityName: string;

  constructor(cityName?: string, rng?: GameRng) {
    if (rng) _rng = rng;
    this.cityName = cityName ?? pick(CITY_NAMES);
  }

  /**
   * Set the city name used in title placeholders.
   */
  public setCityName(name: string): void {
    this.cityName = name;
  }

  /**
   * Generate a unique Soviet leader identity.
   *
   * @param options - Optional constraints on generation.
   * @param options.gender - Force 'male' or 'female'. Default: 85% male, 15% female.
   * @param options.titleCategory - Restrict title to a specific category key from TITLES.
   * @param options.epithet - Force a specific epithet. Default: random.
   * @returns A complete GeneratedLeader identity.
   */
  public generate(options?: {
    gender?: 'male' | 'female';
    titleCategory?: keyof typeof TITLES;
    epithet?: string;
  }): GeneratedLeader {
    const gender =
      options?.gender ?? ((_rng?.random() ?? Math.random()) < 0.85 ? 'male' : 'female');

    // Pick components, retry on duplicate
    let givenName: string;
    let patronymic: string;
    let surname: string;
    let key: string;
    let attempts = 0;

    do {
      givenName = gender === 'male' ? pick(MALE_GIVEN_NAMES) : pick(FEMALE_GIVEN_NAMES);

      const fatherName = pick(PATRONYMIC_FATHER_NAMES);
      patronymic = PATRONYMIC_RULES.generate(fatherName, gender);

      const surnameIndex = pickIndex(SURNAMES_RAW.length);
      surname = getSurname(surnameIndex, gender);

      key = `${givenName}|${patronymic}|${surname}`;
      attempts++;
    } while (this.generatedKeys.has(key) && attempts < 100);

    this.generatedKeys.add(key);

    // Title
    let titlePool: readonly string[];
    if (options?.titleCategory) {
      titlePool = TITLES[options.titleCategory];
    } else {
      titlePool = ALL_TITLES;
    }
    const rawTitle = pick(titlePool);
    const title = rawTitle.replace(/\{CITY\}/g, this.cityName);

    // Epithet
    const epithet = options?.epithet ?? pick(EPITHETS);

    // Format names
    const formalName = `${surname} ${givenName} ${patronymic}`;
    const westernName = `${givenName} ${patronymic} ${surname}`;
    const shortName = `${givenName[0]}.${patronymic[0]}. ${surname}`;
    const introduction = `${title} ${surname}, "${epithet}"`;

    return {
      givenName,
      patronymic,
      surname,
      gender,
      formalName,
      westernName,
      shortName,
      title,
      epithet,
      introduction,
    };
  }

  /**
   * Generate a batch of unique leaders.
   *
   * @param count - Number of leaders to generate.
   * @param options - Optional constraints applied to all.
   * @returns Array of GeneratedLeader identities.
   */
  public generateBatch(
    count: number,
    options?: {
      gender?: 'male' | 'female';
      titleCategory?: keyof typeof TITLES;
    }
  ): GeneratedLeader[] {
    const leaders: GeneratedLeader[] = [];
    for (let i = 0; i < count; i++) {
      leaders.push(this.generate(options));
    }
    return leaders;
  }

  /**
   * Generate a complete Politburo -- one leader per category.
   *
   * @returns A record mapping category name to a generated leader.
   */
  public generatePolitburo(): Record<string, GeneratedLeader> {
    const politburo: Record<string, GeneratedLeader> = {};
    for (const category of Object.keys(TITLES)) {
      politburo[category] = this.generate({ titleCategory: category as keyof typeof TITLES });
    }
    return politburo;
  }

  /**
   * Generate a full government cabinet with one leader per ministry title.
   *
   * @returns Array of leaders, one for each ministry title.
   */
  public generateCabinet(): GeneratedLeader[] {
    return TITLES.ministry.map((title) => {
      const leader = this.generate({ titleCategory: 'ministry' });
      // Override with the specific ministry title
      const resolvedTitle = title.replace(/\{CITY\}/g, this.cityName);
      return {
        ...leader,
        title: resolvedTitle,
        introduction: `${resolvedTitle} ${leader.surname}, "${leader.epithet}"`,
      };
    });
  }

  /**
   * Reset the duplicate tracker. Useful between game sessions.
   */
  public reset(): void {
    this.generatedKeys.clear();
  }

  /**
   * Get the number of unique names generated so far in this session.
   */
  public get generatedCount(): number {
    return this.generatedKeys.size;
  }
}

// ─────────────────────────────────────────────────────────
//  CONVENIENCE EXPORT: default singleton instance
// ─────────────────────────────────────────────────────────

/** Pre-instantiated generator for quick use. */
export const nameGenerator = new NameGenerator();
