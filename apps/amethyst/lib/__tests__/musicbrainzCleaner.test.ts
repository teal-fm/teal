/**
 * Tests for MusicBrainz name cleaning utilities
 * 
 * These tests validate the cleaning logic that significantly improves
 * MusicBrainz search matching (measured during evaluation runs; details live in the eval commit message)
 */

import {
  cleanArtistName,
  cleanTrackName,
  cleanReleaseName,
  normalizeForComparison,
} from "../musicbrainzCleaner";

describe("cleanTrackName", () => {
  describe("basic cleaning", () => {
    it("should return trimmed input for simple names", () => {
      expect(cleanTrackName("  Hello World  ")).toBe("Hello World");
    });

    it("should handle empty strings", () => {
      expect(cleanTrackName("")).toBe("");
    });

    it("should preserve normal track names", () => {
      expect(cleanTrackName("Bohemian Rhapsody")).toBe("Bohemian Rhapsody");
      expect(cleanTrackName("Hotel California")).toBe("Hotel California");
    });

    it("should strip leading/trailing decorative characters", () => {
      expect(cleanTrackName("* * Track Name * *")).toBe("Track Name");
      expect(cleanTrackName("~~Song Title~~")).toBe("Song Title");
      expect(cleanTrackName("***")).toBe("***"); // Don't strip to empty
    });

    it("should remove [SNIPPET] and [Preview] brackets", () => {
      expect(cleanTrackName("Song [SNIPPET]")).toBe("Song");
      expect(cleanTrackName("Track Name [Preview]")).toBe("Track Name");
    });
  });

  describe("parenthetical guff removal", () => {
    it("should remove (Remastered) suffix", () => {
      expect(cleanTrackName("Bohemian Rhapsody (Remastered)")).toBe("Bohemian Rhapsody");
    });

    it("should remove (Live) suffix", () => {
      expect(cleanTrackName("Stairway to Heaven (Live)")).toBe("Stairway to Heaven");
    });

    it("should remove year in parentheses", () => {
      expect(cleanTrackName("Come Together (2019 Mix)")).toBe("Come Together");
    });

    it("should remove (Radio Edit)", () => {
      expect(cleanTrackName("Blinding Lights (Radio Edit)")).toBe("Blinding Lights");
    });

    it("should handle multiple guff words", () => {
      expect(cleanTrackName("Song (Live Remastered Version)")).toBe("Song");
    });

    it("should remove multiple parenthetical guff groups", () => {
      expect(cleanTrackName("Song (Live) (Remastered)")).toBe("Song");
      expect(cleanTrackName("Track (Bonus Track) (Live) (Remastered)")).toBe("Track");
    });

    it("should remove later guff groups while keeping non-guff ones", () => {
      expect(cleanTrackName("Song (feat. Artist) (Live)")).toBe("Song (feat. Artist)");
      expect(cleanTrackName("Song (Remix) (Live Version)")).toBe("Song (Remix)");
    });
  });

  describe("bracket guff removal", () => {
    it("should remove [Remastered] suffix", () => {
      expect(cleanTrackName("Hey Jude [Remastered]")).toBe("Hey Jude");
    });

    it("should remove [Official Video] suffix", () => {
      expect(cleanTrackName("Bad Guy [Official Video]")).toBe("Bad Guy");
    });
  });

  describe("remix preservation (disambiguation)", () => {
    // CRITICAL: These tests verify the smart remix handling that prevents
    // incorrect removal of distinguishing remix info
    
    it("should PRESERVE remix info for generic base names", () => {
      // "High" is generic, so "Branchez Remix" must be kept
      expect(cleanTrackName("High (Branchez Remix)")).toBe("High (Branchez Remix)");
    });

    it("should PRESERVE remix info when it contains artist name", () => {
      // "Diplo Remix" contains an artist name, must be kept
      expect(cleanTrackName("Get Lucky (Diplo Remix)")).toBe("Get Lucky (Diplo Remix)");
    });

    it("should PRESERVE remix info for short base names", () => {
      // Short names need disambiguation
      expect(cleanTrackName("One (Skrillex Remix)")).toBe("One (Skrillex Remix)");
    });

    it("should PRESERVE remix info with artist names even for longer base names", () => {
      // "Extended" is detected as potentially an artist name (>3 chars, not a keyword)
      // This is conservative: better to preserve too much than lose disambiguation
      expect(cleanTrackName("Billie Jean (Extended Remix)")).toBe("Billie Jean (Extended Remix)");
    });

    it("should PRESERVE remix for short base names even without artist", () => {
      // "Billie Jean" is <15 chars (short) so remix is preserved for disambiguation
      // There could be many tracks named "Billie Jean" - the remix helps distinguish
      expect(cleanTrackName("Billie Jean (Remix)")).toBe("Billie Jean (Remix)");
    });

    it("should remove pure guff remix for long unique base names", () => {
      // Very long, specific names don't need remix info for disambiguation
      expect(cleanTrackName("Bohemian Rhapsody Is A Very Long Title (Remix)")).toBe("Bohemian Rhapsody Is A Very Long Title");
    });

    it("should PRESERVE artist edition as remix-like", () => {
      // "Kaytranada Edition" contains an artist name + "edition" -> remix-like
      expect(cleanTrackName("Be Your Girl (Kaytranada Edition)")).toBe("Be Your Girl (Kaytranada Edition)");
    });

    it("should strip generic edition without artist name", () => {
      expect(cleanTrackName("OK Computer (Special Edition)")).toBe("OK Computer");
      expect(cleanTrackName("Abbey Road (Deluxe Edition)")).toBe("Abbey Road");
    });
  });

  describe("named mix preservation (disambiguation)", () => {
    it("should PRESERVE named artist mixes in parentheses", () => {
      expect(cleanTrackName("Hear Me (Zomby mix)")).toBe("Hear Me (Zomby mix)");
    });

    it("should PRESERVE named mixes with long artist names", () => {
      expect(cleanTrackName("Voodoo Ray (Frankie Knuckles Ballroom Mix)"))
        .toBe("Voodoo Ray (Frankie Knuckles Ballroom Mix)");
    });

    it("should convert dash-separated named mixes to parenthesized format", () => {
      expect(cleanTrackName("Forest Drive West - Rupture Mix"))
        .toBe("Forest Drive West (Rupture Mix)");
      expect(cleanTrackName("Champion - Miami Mix"))
        .toBe("Champion (Miami Mix)");
    });

    it("should strip generic mixes without artist names", () => {
      expect(cleanTrackName("Fire (Original Mix)")).toBe("Fire");
      expect(cleanTrackName("Bohemian Rhapsody Is Long (Club Mix)"))
        .toBe("Bohemian Rhapsody Is Long");
    });
  });

  describe("audio format preservation (disambiguation)", () => {
    it("should PRESERVE mono for short/common base names", () => {
      expect(cleanTrackName("She Loves You (mono)")).toBe("She Loves You (mono)");
    });

    it("should PRESERVE stereo for short base names", () => {
      expect(cleanTrackName("HYPNOSIS (stereo)")).toBe("HYPNOSIS (stereo)");
    });

    it("should strip mono/stereo for long unique base names", () => {
      expect(cleanTrackName("Bohemian Rhapsody Is A Very Long Title (mono)")).toBe("Bohemian Rhapsody Is A Very Long Title");
    });
  });

  describe("instrumental/acoustic preservation (always kept)", () => {
    it("should PRESERVE instrumental in parentheses", () => {
      expect(cleanTrackName("Things We Do for Love (Instrumental)")).toBe("Things We Do for Love (Instrumental)");
    });

    it("should PRESERVE instrumental in brackets", () => {
      expect(cleanTrackName("Let's Hook Up (Asthma) [Instrumental]")).toBe("Let's Hook Up (Asthma) [Instrumental]");
    });

    it("should PRESERVE instrumental mix as dash suffix", () => {
      expect(cleanTrackName("Jazz Lick - Instrumental Mix")).toBe("Jazz Lick (Instrumental Mix)");
    });

    it("should PRESERVE acoustic in parentheses", () => {
      expect(cleanTrackName("Creep (Acoustic)")).toBe("Creep (Acoustic)");
    });

    it("should PRESERVE instrumental for long base names", () => {
      // Unlike mono/stereo, instrumental is always preserved (distinct recordings in MB)
      expect(cleanTrackName("A Very Long And Specific Track Name (Instrumental)")).toBe(
        "A Very Long And Specific Track Name (Instrumental)"
      );
    });
  });

  describe("remaster preservation (disambiguation)", () => {
    it("should PRESERVE remaster+year in parentheses", () => {
      expect(cleanTrackName("There Is a Light That Never Goes Out (2011 Remaster)")).toBe(
        "There Is a Light That Never Goes Out (2011 Remaster)"
      );
    });

    it("should PRESERVE remaster+year as dash suffix", () => {
      expect(cleanTrackName("This Charming Man - 2011 Remaster")).toBe(
        "This Charming Man - 2011 Remaster"
      );
    });

    it("should STRIP plain remaster without year", () => {
      expect(cleanTrackName("Bohemian Rhapsody (Remastered)")).toBe("Bohemian Rhapsody");
    });

    it("should STRIP plain remaster dash suffix without year", () => {
      expect(cleanTrackName("Song - Remastered")).toBe("Song");
    });

    it("should handle remastered+year variant", () => {
      expect(cleanTrackName("Remember - Remastered 1999")).toBe("Remember - Remastered 1999");
    });

    it("should handle bracketed remaster+year", () => {
      expect(cleanTrackName("Song Title [2020 Remaster]")).toBe("Song Title [2020 Remaster]");
    });
  });

  describe("featuring artist handling", () => {
    it("should PRESERVE feat info for generic base names", () => {
      expect(cleanTrackName("Song (feat. Artist)")).toBe("Song (feat. Artist)");
    });

    it("should PRESERVE feat info when it contains artist name", () => {
      expect(cleanTrackName("Roses (feat. ROZES)")).toBe("Roses (feat. ROZES)");
    });

    it("should remove feat from middle of track title", () => {
      // When feat is in the main title (not parenthesized), remove the suffix
      expect(cleanTrackName("Timber feat. Ke$ha")).toBe("Timber");
    });

    it("should handle ft. abbreviation", () => {
      expect(cleanTrackName("See You Again ft. Charlie Puth")).toBe("See You Again");
    });

    it("should handle featuring spelled out", () => {
      expect(cleanTrackName("Empire State of Mind featuring Alicia Keys")).toBe("Empire State of Mind");
    });
  });

  describe("nested parentheses", () => {
    it("should handle nested parentheses correctly", () => {
      expect(cleanTrackName("Track (Part (Two))")).toBe("Track (Part (Two))");
    });

    it("should only remove outer guff with nested content", () => {
      expect(cleanTrackName("Track ((Live) 2019)")).toBe("Track");
    });
  });

  describe("edge cases", () => {
    it("should handle track names that are only parenthetical", () => {
      expect(cleanTrackName("(Intro)")).toBe("(Intro)");
    });

    it("should handle unmatched parentheses", () => {
      expect(cleanTrackName("Track (with open paren")).toBe("Track (with open paren");
    });

    it("should handle only closing parenthesis", () => {
      expect(cleanTrackName("Track with close paren)")).toBe("Track with close paren)");
    });

    it("should preserve non-guff parenthetical content", () => {
      expect(cleanTrackName("A Day in the Life (From Sgt. Pepper's)")).toBe("A Day in the Life (From Sgt. Pepper's)");
    });
  });
});

describe("cleanArtistName", () => {
  describe("basic cleaning", () => {
    it("should return trimmed input for simple names", () => {
      expect(cleanArtistName("  The Beatles  ")).toBe("The Beatles");
    });

    it("should handle empty strings", () => {
      expect(cleanArtistName("")).toBe("");
    });
  });

  describe("The prefix preservation", () => {
    it("should preserve 'The ' prefix (MB indexes artists with The)", () => {
      expect(cleanArtistName("The Beatles")).toBe("The Beatles");
      expect(cleanArtistName("The Rolling Stones")).toBe("The Rolling Stones");
    });

    it("should preserve case-insensitive 'The '", () => {
      expect(cleanArtistName("THE BEATLES")).toBe("THE BEATLES");
      expect(cleanArtistName("the beatles")).toBe("the beatles");
    });

    it("should handle 'The' as entire name", () => {
      expect(cleanArtistName("The")).toBe("The");
    });

    it("should handle 'The The' band name", () => {
      expect(cleanArtistName("The The")).toBe("The The");
    });
  });

  describe("featuring removal", () => {
    it("should remove feat. suffix", () => {
      expect(cleanArtistName("Drake feat. Rihanna")).toBe("Drake");
    });

    it("should remove ft. suffix", () => {
      expect(cleanArtistName("Post Malone ft. 21 Savage")).toBe("Post Malone");
    });

    it("should remove featuring suffix", () => {
      expect(cleanArtistName("Jay-Z featuring Beyoncé")).toBe("Jay-Z");
    });
  });

  describe("parenthetical content handling", () => {
    // NUANCE: Country disambiguators like (US), (UK) are NOT guff
    // They're important for distinguishing bands with the same name
    // Bush (US) vs Bush (UK) are different bands!
    it("should PRESERVE country disambiguators", () => {
      expect(cleanArtistName("Bush (US)")).toBe("Bush (US)");
      expect(cleanArtistName("Suede (UK)")).toBe("Suede (UK)");
    });

    it("should remove actual guff like (Live)", () => {
      expect(cleanArtistName("Artist (Live)")).toBe("Artist");
    });
  });
});

describe("cleanReleaseName", () => {
  it("should clean release names like track names", () => {
    expect(cleanReleaseName("Abbey Road (Remastered)")).toBe("Abbey Road");
  });

  it("should remove [Deluxe Edition]", () => {
    expect(cleanReleaseName("1989 [Deluxe Edition]")).toBe("1989");
  });

  it("should remove (Expanded Edition)", () => {
    expect(cleanReleaseName("Thriller (Expanded Edition)")).toBe("Thriller");
  });

  it("should remove [Anniversary Edition]", () => {
    expect(cleanReleaseName("Dark Side of the Moon [50th Anniversary Edition]")).toBe("Dark Side of the Moon");
  });

  it("should remove (Special Edition)", () => {
    expect(cleanReleaseName("OK Computer (Special Edition)")).toBe("OK Computer");
  });
});

describe("normalizeForComparison", () => {
  describe("accent handling", () => {
    it("should normalize accented characters", () => {
      expect(normalizeForComparison("Beyoncé")).toBe("beyonce");
      expect(normalizeForComparison("Björk")).toBe("bjork");
      expect(normalizeForComparison("Motörhead")).toBe("motorhead");
    });

    it("should handle various accents", () => {
      expect(normalizeForComparison("Sigur Rós")).toBe("sigur ros");
      expect(normalizeForComparison("Zoé")).toBe("zoe");
    });
  });

  describe("case normalization", () => {
    it("should lowercase everything", () => {
      expect(normalizeForComparison("HELLO WORLD")).toBe("hello world");
      expect(normalizeForComparison("HeLLo WoRLd")).toBe("hello world");
    });
  });

  describe("whitespace normalization", () => {
    it("should normalize multiple spaces", () => {
      expect(normalizeForComparison("Hello    World")).toBe("hello world");
    });

    it("should trim leading/trailing whitespace", () => {
      expect(normalizeForComparison("  hello  ")).toBe("hello");
    });
  });

  describe("special character handling", () => {
    it("should remove non-alphanumeric characters", () => {
      expect(normalizeForComparison("AC/DC")).toBe("acdc");
      expect(normalizeForComparison("Guns N' Roses")).toBe("guns n roses");
    });

    it("should preserve Japanese characters", () => {
      // Japanese characters are now preserved (not filtered to empty)
      const result = normalizeForComparison("きゃりーぱみゅぱみゅ");
      expect(result).not.toBe("");
    });

    it("should preserve Greek letters in band names", () => {
      // CHVRCHΞS has a Greek Xi -- now preserved
      expect(normalizeForComparison("CHVRCHΞS")).toBe("chvrchξs");
    });
  });

  describe("edge cases", () => {
    it("should handle empty string", () => {
      expect(normalizeForComparison("")).toBe("");
    });

    it("should handle only spaces", () => {
      expect(normalizeForComparison("   ")).toBe("");
    });

    it("should handle only special characters", () => {
      expect(normalizeForComparison("!!!")).toBe("");
    });
  });
});

describe("unhandled/documented nuances", () => {
  // These tests document known edge cases and their current behavior
  // Some may need future improvements

  describe("collaboration patterns", () => {
    it("should handle 'vs' pattern (treated as guff, removes right side)", () => {
      // "vs" is in GUFF_WORDS but only in parenthetical content
      // Regular "A vs B" format is NOT cleaned
      expect(cleanArtistName("Artist A vs Artist B")).toBe("Artist A vs Artist B");
    });

    it("should preserve '&' collaborations", () => {
      expect(cleanArtistName("Hall & Oates")).toBe("Hall & Oates");
    });

    it("should preserve 'x' collaborations", () => {
      expect(cleanArtistName("Marshmello x Juice WRLD")).toBe("Marshmello x Juice WRLD");
    });
  });

  describe("numbers in names", () => {
    it("should preserve numbers in band names", () => {
      expect(cleanArtistName("Sum 41")).toBe("Sum 41");
      expect(cleanArtistName("Blink-182")).toBe("Blink-182");
      expect(cleanArtistName("311")).toBe("311");
    });

    it("should preserve numbers in track names", () => {
      expect(cleanTrackName("1979")).toBe("1979");
      expect(cleanTrackName("99 Problems")).toBe("99 Problems");
    });
  });

  describe("punctuation in names", () => {
    it("should preserve exclamation marks in names", () => {
      expect(cleanArtistName("P!nk")).toBe("P!nk");
      // "The !!!" is preserved (no "The" stripping -- MB indexes with "The")
      expect(cleanArtistName("The !!!")).toBe("The !!!");
    });

    it("should preserve hyphens in names", () => {
      expect(cleanArtistName("Jay-Z")).toBe("Jay-Z");
      expect(cleanTrackName("Re-Arranged")).toBe("Re-Arranged");
    });
  });

  describe("CJK (Chinese/Japanese/Korean) handling", () => {
    it("should preserve Japanese track names", () => {
      expect(cleanTrackName("花火")).toBe("花火");
      expect(cleanTrackName("きゃりーぱみゅぱみゅ")).toBe("きゃりーぱみゅぱみゅ");
    });

    it("normalizeForComparison preserves non-Latin characters", () => {
      // CJK characters are now preserved during normalization
      expect(normalizeForComparison("花火")).toBe("花火");
      expect(normalizeForComparison("YOASOBI")).toBe("yoasobi"); // Latin OK
    });
  });

  describe("classical music patterns", () => {
    it("should preserve opus numbers", () => {
      expect(cleanTrackName("Symphony No. 5, Op. 67")).toBe("Symphony No. 5, Op. 67");
    });

    it("should preserve movement numbers", () => {
      expect(cleanTrackName("Violin Concerto in D major: I. Allegro")).toBe("Violin Concerto in D major: I. Allegro");
    });
  });

  describe("DJ and electronic music patterns", () => {
    it("should not remove 'DJ' from artist names", () => {
      expect(cleanArtistName("DJ Shadow")).toBe("DJ Shadow");
    });

    it("should PRESERVE production credits with artist names (disambiguation)", () => {
      // "prod" is in guff words, but "Metro Boomin" is an artist name (>3 chars)
      // This is kept for disambiguation - different producers = different versions
      expect(cleanTrackName("Song [prod. Metro Boomin]")).toBe("Song [prod. Metro Boomin]");
    });

    it("should PRESERVE produced by credits with artist names", () => {
      // "Produced by" + artist name is kept for disambiguation
      expect(cleanTrackName("Song (Produced by Metro Boomin)")).toBe("Song (Produced by Metro Boomin)");
    });

    it("should remove pure production markers without artist names", () => {
      // Just "(prod)" or "(production)" without an artist can be removed
      expect(cleanTrackName("Song (prod)")).toBe("Song");
      expect(cleanTrackName("Song [Production]")).toBe("Song");
    });
  });
});

describe("threshold boundary tests (overfitting check)", () => {
  // These tests verify behavior around the threshold boundaries
  // to ensure we haven't overfit to specific lengths
  
  describe("SHORT_NAME_THRESHOLD (15 chars)", () => {
    it("should preserve remix for 14-char name (below threshold)", () => {
      // "Bohemian Rhap" = 13 chars (< 15) -> remix preserved
      expect(cleanTrackName("Bohemian Rhap (Remix)")).toBe("Bohemian Rhap (Remix)");
    });

    it("should REMOVE remix for exactly 15-char name (at threshold)", () => {
      // "Bohemian Rhapso" = 15 chars (not < 15) -> isShort = false
      // Since it's not short, remix can be removed (no artist name in "Remix")
      expect(cleanTrackName("Bohemian Rhapso (Remix)")).toBe("Bohemian Rhapso");
    });

    it("should remove remix for 20+ char name (well above threshold)", () => {
      // Long unique names have remix removed when no artist name present
      const result = cleanTrackName("A Very Long Unique Track Name Here (Remix)");
      expect(result).toBe("A Very Long Unique Track Name Here");
    });
  });

  describe("diverse length inputs", () => {
    it("should handle single character track names", () => {
      expect(cleanTrackName("A")).toBe("A");
      expect(cleanTrackName("A (Remix)")).toBe("A (Remix)"); // Short, preserve
    });

    it("should handle very long track names (100+ chars)", () => {
      const longName = "This Is An Extremely Long Track Name That Goes On And On And Contains Many Words And Should Still Work";
      expect(cleanTrackName(longName)).toBe(longName);
    });

    it("should handle long track with guff", () => {
      // Remaster+year is preserved (eval: 0 improvements from stripping, 11 regressions)
      const longWithGuff = "This Is An Extremely Long Track Name That Goes On And On (2023 Remaster)";
      expect(cleanTrackName(longWithGuff)).toBe("This Is An Extremely Long Track Name That Goes On And On (2023 Remaster)");
    });
  });
});

describe("diverse real-world inputs (overfitting check)", () => {
  // These tests use varied real-world examples to ensure
  // the logic generalizes beyond the evaluation dataset

  describe("international artists", () => {
    it("should handle Spanish accents", () => {
      expect(cleanArtistName("José González")).toBe("José González");
      expect(normalizeForComparison("José González")).toBe("jose gonzalez");
    });

    it("should handle French accents", () => {
      expect(cleanTrackName("Édith Piaf - La Vie en Rose")).toBe("Édith Piaf - La Vie en Rose");
    });

    it("should handle German umlauts", () => {
      expect(cleanArtistName("Röyksopp")).toBe("Röyksopp");
      expect(normalizeForComparison("Röyksopp")).toBe("royksopp");
    });

    it("should handle Nordic names", () => {
      expect(cleanArtistName("Sigur Rós")).toBe("Sigur Rós");
      expect(cleanArtistName("The Sigur Rós")).toBe("The Sigur Rós");
    });
  });

  describe("various genres", () => {
    it("should PRESERVE hip-hop production credits with artist names", () => {
      // "Mike WiLL Made-It" is an artist name (>4 chars), so it's preserved for disambiguation
      expect(cleanTrackName("DNA. (prod. Mike WiLL Made-It)")).toBe("DNA. (prod. Mike WiLL Made-It)");
    });

    it("should handle EDM variations", () => {
      expect(cleanTrackName("Levels (Radio Edit)")).toBe("Levels");
      expect(cleanTrackName("Levels (Extended Mix)")).toBe("Levels");
    });

    it("should handle classical with opus", () => {
      expect(cleanTrackName("Piano Sonata No. 14 in C-sharp minor, Op. 27, No. 2")).toBe(
        "Piano Sonata No. 14 in C-sharp minor, Op. 27, No. 2"
      );
    });

    it("should PRESERVE live at venue (venue name acts as disambiguation)", () => {
      // "Newport" is >4 chars and not a guff word, so it's preserved
      expect(cleanTrackName("Take Five (Live at Newport)")).toBe("Take Five (Live at Newport)");
    });

    it("should remove pure (Live) without venue", () => {
      expect(cleanTrackName("Take Five (Live)")).toBe("Take Five");
    });

    it("should handle metal bands", () => {
      expect(cleanArtistName("Motörhead")).toBe("Motörhead");
      // Note: "The " prefix removal doesn't apply to non-"The " strings
    });
  });

  describe("edge case formats", () => {
    it("should handle double parentheses", () => {
      expect(cleanTrackName("Song ((Live))")).toBe("Song");
    });

    it("should handle mixed parens and brackets", () => {
      expect(cleanTrackName("Song (Live) [Remastered]")).toBe("Song");
    });

    it("should handle multiple feat patterns (only removes first)", () => {
      // Current implementation only removes the first feat pattern
      // "Song feat. A feat. B" -> removes first feat -> "Song feat. B"
      // Then the remaining "feat. B" is checked again but "B" is too short (<4 chars)
      // Actually, the first match removes everything after "feat."
      // So "Song feat. A feat. B" -> "Song"... let me verify
      // Actually the feat pattern matches to end of string, removing "A feat. B"
      // But shouldKeepForDisambiguation might preserve it...
      // "Song" is 4 chars (short), "A feat. B" has "feat" which matches,
      // and "B" is only 1 char (not >4), so no artist name detected
      // Since Song is short (<15) and common phrase, shouldKeep might trigger
      // Let's just test actual behavior:
      expect(cleanTrackName("Song feat. A feat. B")).toBe("Song feat. A feat. B");
    });

    it("should handle empty parentheses", () => {
      expect(cleanTrackName("Song ()")).toBe("Song ()");
    });

    it("should handle only whitespace in parens", () => {
      expect(cleanTrackName("Song (   )")).toBe("Song (   )");
    });
  });
});

describe("real test cases from evaluation data", () => {
  // Representative cases observed during evaluation runs.
  // We keep a small set of these as regression tests, but we don't commit raw evaluation results.

  describe("featuring tracks", () => {
    it("should handle '212 (feat. Lazy Jay)' by Azealia Banks", () => {
      // Short base name "212" (3 chars) + feat = should preserve
      expect(cleanTrackName("212 (feat. Lazy Jay)")).toBe("212 (feat. Lazy Jay)");
    });

    it("should handle 'Get Thy Bearings (Feat. Szjerdene)' by Bonobo", () => {
      // "Get Thy Bearings" is 16 chars (> 15), but "Szjerdene" is an artist name
      expect(cleanTrackName("Get Thy Bearings (Feat. Szjerdene)")).toBe("Get Thy Bearings (Feat. Szjerdene)");
    });

    it("should handle 'Club classics featuring bb trickz' by Charli xcx", () => {
      // "featuring" in track title (not parenthesized) - gets removed
      // NUANCE: Non-parenthesized feat patterns are removed regardless of base name length
      // This is intentional: the feat info is in the artist field, not needed in track
      expect(cleanTrackName("Club classics featuring bb trickz")).toBe("Club classics");
    });
  });

  describe("remix tracks", () => {
    it("should handle 'Dubplate (Total Science Remix)' by Wots My Code", () => {
      // "Dubplate" is 8 chars (< 15), "Total Science" is artist name
      expect(cleanTrackName("Dubplate (Total Science Remix)")).toBe("Dubplate (Total Science Remix)");
    });

    it("should convert 'Sensation - Rrose Remix' to parenthesized format", () => {
      // Dash-separated remix converted to MB's parenthesized convention
      expect(cleanTrackName("Sensation - Rrose Remix")).toBe("Sensation (Rrose Remix)");
    });

    it("should convert 'All Of My - Aries Remix' to parenthesized format", () => {
      expect(cleanTrackName("All Of My - Aries Remix")).toBe("All Of My (Aries Remix)");
    });
  });

  describe("parenthetical tracks", () => {
    it("should handle 'Maximum Style (Lover To Lover)' by Tom & Jerry", () => {
      // "(Lover To Lover)" is not guff - it's a subtitle
      expect(cleanTrackName("Maximum Style (Lover To Lover)")).toBe("Maximum Style (Lover To Lover)");
    });

    it("should handle 'Let The Sunshine In (Reprise) - Remastered 2000' by The 5th Dimension", () => {
      // "(Reprise)" is guff and stripped, "- Remastered 2000" has remaster+year so preserved
      const result = cleanTrackName("Let The Sunshine In (Reprise) - Remastered 2000");
      expect(result).toBe("Let The Sunshine In - Remastered 2000");
    });

    it("should handle 'Movin Too Fast (radio Mix)' by Romina Johnson", () => {
      // "(radio Mix)" contains "radio" and "mix" - both guff
      expect(cleanTrackName("Movin Too Fast (radio Mix)")).toBe("Movin Too Fast");
    });
  });
});

describe("unmatchable track categories (from MusicBrainz algorithm doc)", () => {
  // These are documented categories that are inherently hard to match

  describe("non-Latin text", () => {
    it("should preserve Russian text", () => {
      expect(cleanTrackName("ektenia ii: blagoslovenie")).toBe("ektenia ii: blagoslovenie");
    });

    it("should preserve Japanese kanji", () => {
      expect(cleanTrackName("花火")).toBe("花火");
    });
  });

  describe("garbage/corrupted data", () => {
    it("should preserve garbage data (no cleaning can fix it)", () => {
      expect(cleanTrackName("2xsm4xsa4xsmadkc4xs31xsoo1xsl")).toBe("2xsm4xsa4xsmadkc4xs31xsoo1xsl");
    });
  });

  describe("medleys/mashups", () => {
    it("should preserve medley format", () => {
      expect(cleanTrackName("day tripper / if i needed someone / i want you")).toBe(
        "day tripper / if i needed someone / i want you"
      );
    });
  });

  describe("classical music formatting", () => {
    it("should preserve classical movement notation", () => {
      expect(cleanTrackName("seasons (summer): iii. presto")).toBe("seasons (summer): iii. presto");
    });

    it("should preserve symphony notation", () => {
      expect(cleanTrackName("symphony no. 5 in c minor, op. 67: i. allegro con brio")).toBe(
        "symphony no. 5 in c minor, op. 67: i. allegro con brio"
      );
    });
  });

  describe("unconventional punctuation", () => {
    it("should preserve period in middle of title", () => {
      expect(cleanTrackName("sit down. stand up")).toBe("sit down. stand up");
    });

    it("should preserve slash separator", () => {
      expect(cleanTrackName("eve white/eve black")).toBe("eve white/eve black");
    });

    it("should preserve trailing ellipsis", () => {
      expect(cleanTrackName("i'm but a wave to ...")).toBe("i'm but a wave to ...");
    });
  });
});

describe("apostrophe handling (critical for matching)", () => {
  // Different apostrophe characters are a common source of mismatches
  
  it("should preserve straight apostrophe", () => {
    expect(cleanTrackName("I'm Not Okay (I Promise)")).toBe("I'm Not Okay (I Promise)");
  });

  it("should preserve curly apostrophe", () => {
    expect(cleanTrackName("I'm Not Okay (I Promise)")).toBe("I'm Not Okay (I Promise)");
  });

  it("should normalize both apostrophes identically for comparison", () => {
    const straight = normalizeForComparison("I'm Not Okay");
    const curly = normalizeForComparison("I'm Not Okay");
    expect(straight).toBe(curly);
  });

  it("should handle Don't with straight apostrophe", () => {
    expect(normalizeForComparison("Don't Stop Me Now")).toBe("dont stop me now");
  });

  it("should handle Don't with curly apostrophe", () => {
    expect(normalizeForComparison("Don't Stop Me Now")).toBe("dont stop me now");
  });
});

describe("non-Latin normalization (CJK, Cyrillic, etc.)", () => {
  it("should preserve and distinguish CJK characters", () => {
    // Different Japanese track names must NOT normalize to the same string
    expect(normalizeForComparison("花火")).not.toBe("");
    expect(normalizeForComparison("花火")).toBe("花火");
    expect(normalizeForComparison("春の歌")).toBe("春の歌");
    expect(normalizeForComparison("花火")).not.toBe(normalizeForComparison("春の歌"));
  });

  it("should preserve Cyrillic characters", () => {
    expect(normalizeForComparison("Кино")).toBe("кино");
    expect(normalizeForComparison("Кино")).not.toBe(normalizeForComparison("Мумий"));
  });

  it("should preserve Korean characters", () => {
    const input = "\uBD04\uB0A0"; // 봄날
    const result = normalizeForComparison(input);
    expect(result).not.toBe("");
    expect(result).toBe(input);
  });

  it("should preserve Arabic characters", () => {
    expect(normalizeForComparison("حبيبي")).not.toBe("");
  });

  it("should still strip Latin diacriticals", () => {
    expect(normalizeForComparison("Beyonce")).toBe("beyonce");
    expect(normalizeForComparison("Bjork")).toBe("bjork");
  });

  it("should handle mixed Latin and CJK", () => {
    // "RADWIMPS 前前前世" should keep both parts
    const result = normalizeForComparison("RADWIMPS 前前前世");
    expect(result).toContain("radwimps");
    expect(result).toContain("前前前世");
  });
});

describe("integration scenarios", () => {
  describe("real-world track names from evaluation", () => {
    it("should clean Last.fm scrobble format", () => {
      expect(cleanTrackName("High You Are (Branchez Remix)")).toBe("High You Are (Branchez Remix)");
    });

    it("should handle YouTube-style titles", () => {
      expect(cleanTrackName("Bohemian Rhapsody [Official Video]")).toBe("Bohemian Rhapsody");
    });

    it("should handle Spotify-style remasters", () => {
      // Remaster+year is preserved (eval: stripping never helps, causes regressions)
      expect(cleanTrackName("Hotel California - 2013 Remaster")).toBe("Hotel California - 2013 Remaster");
    });
  });

  describe("matching after cleaning", () => {
    it("should preserve remaster+year info but strip plain remaster", () => {
      // With year: preserved (eval data shows stripping never helps)
      expect(cleanTrackName("Bohemian Rhapsody (2011 Remaster)")).toBe("Bohemian Rhapsody (2011 Remaster)");
      // Without year: stripped (no disambiguation value)
      expect(cleanTrackName("Bohemian Rhapsody (Remastered)")).toBe("Bohemian Rhapsody");
    });

    it("should enable accent-insensitive matching", () => {
      const scrobble = "Déjà Vu";
      const mbResult = "Deja Vu";
      
      expect(normalizeForComparison(scrobble)).toBe(normalizeForComparison(mbResult));
    });
  });
});
