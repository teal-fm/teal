/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { LexiconDoc, Lexicons } from "@atproto/lexicon";

export const schemaDict = {
  AppBskyActorProfile: {
    lexicon: 1,
    id: "app.bsky.actor.profile",
    defs: {
      main: {
        type: "record",
        description: "A declaration of a Bluesky account profile.",
        key: "literal:self",
        record: {
          type: "object",
          properties: {
            displayName: {
              type: "string",
              maxGraphemes: 64,
              maxLength: 640,
            },
            description: {
              type: "string",
              description: "Free-form profile description text.",
              maxGraphemes: 256,
              maxLength: 2560,
            },
            avatar: {
              type: "blob",
              description:
                "Small image to be displayed next to posts from account. AKA, 'profile picture'",
              accept: ["image/png", "image/jpeg"],
              maxSize: 1000000,
            },
            banner: {
              type: "blob",
              description:
                "Larger horizontal image to display behind profile view.",
              accept: ["image/png", "image/jpeg"],
              maxSize: 1000000,
            },
            labels: {
              type: "union",
              description:
                "Self-label values, specific to the Bluesky application, on the overall account.",
              refs: ["lex:com.atproto.label.defs#selfLabels"],
            },
            joinedViaStarterPack: {
              type: "ref",
              ref: "lex:com.atproto.repo.strongRef",
            },
            createdAt: {
              type: "string",
              format: "datetime",
            },
          },
        },
      },
    },
  },
  AppBskyRichtextFacet: {
    lexicon: 1,
    id: "app.bsky.richtext.facet",
    defs: {
      main: {
        type: "object",
        description: "Annotation of a sub-string within rich text.",
        required: ["index", "features"],
        properties: {
          index: {
            type: "ref",
            ref: "lex:app.bsky.richtext.facet#byteSlice",
          },
          features: {
            type: "array",
            items: {
              type: "union",
              refs: [
                "lex:app.bsky.richtext.facet#mention",
                "lex:app.bsky.richtext.facet#link",
                "lex:app.bsky.richtext.facet#tag",
              ],
            },
          },
        },
      },
      mention: {
        type: "object",
        description:
          "Facet feature for mention of another account. The text is usually a handle, including a '@' prefix, but the facet reference is a DID.",
        required: ["did"],
        properties: {
          did: {
            type: "string",
            format: "did",
          },
        },
      },
      link: {
        type: "object",
        description:
          "Facet feature for a URL. The text URL may have been simplified or truncated, but the facet reference should be a complete URL.",
        required: ["uri"],
        properties: {
          uri: {
            type: "string",
            format: "uri",
          },
        },
      },
      tag: {
        type: "object",
        description:
          "Facet feature for a hashtag. The text usually includes a '#' prefix, but the facet reference should not (except in the case of 'double hash tags').",
        required: ["tag"],
        properties: {
          tag: {
            type: "string",
            maxLength: 640,
            maxGraphemes: 64,
          },
        },
      },
      byteSlice: {
        type: "object",
        description:
          "Specifies the sub-string range a facet feature applies to. Start index is inclusive, end index is exclusive. Indices are zero-indexed, counting bytes of the UTF-8 encoded text. NOTE: some languages, like Javascript, use UTF-16 or Unicode codepoints for string slice indexing; in these languages, convert to byte arrays before working with facets.",
        required: ["byteStart", "byteEnd"],
        properties: {
          byteStart: {
            type: "integer",
            minimum: 0,
          },
          byteEnd: {
            type: "integer",
            minimum: 0,
          },
        },
      },
    },
  },
  FmTealAlphaActorDefs: {
    lexicon: 1,
    id: "fm.teal.alpha.actor.defs",
    defs: {
      profileView: {
        type: "object",
        properties: {
          did: {
            type: "string",
            description: "The decentralized identifier of the actor",
          },
          displayName: {
            type: "string",
          },
          description: {
            type: "string",
            description: "Free-form profile description text.",
          },
          descriptionFacets: {
            type: "array",
            description:
              "Annotations of text in the profile description (mentions, URLs, hashtags, etc). May be changed to another (backwards compatible) lexicon.",
            items: {
              type: "ref",
              ref: "lex:app.bsky.richtext.facet",
            },
          },
          featuredItem: {
            type: "ref",
            description:
              "The user's most recent item featured on their profile.",
            ref: "lex:fm.teal.alpha.actor.profile#featuredItem",
          },
          avatar: {
            type: "string",
            description: "IPLD of the avatar",
          },
          banner: {
            type: "string",
            description: "IPLD of the banner image",
          },
          createdAt: {
            type: "string",
            format: "datetime",
          },
        },
      },
      miniProfileView: {
        type: "object",
        properties: {
          did: {
            type: "string",
            description: "The decentralized identifier of the actor",
          },
          displayName: {
            type: "string",
          },
          handle: {
            type: "string",
          },
          avatar: {
            type: "string",
            description: "IPLD of the avatar",
          },
        },
      },
    },
  },
  FmTealAlphaActorGetProfile: {
    lexicon: 1,
    id: "fm.teal.alpha.actor.getProfile",
    description:
      "This lexicon is in a not officially released state. It is subject to change. | Retrieves a play given an author DID and record key.",
    defs: {
      main: {
        type: "query",
        parameters: {
          type: "params",
          required: ["actor"],
          properties: {
            actor: {
              type: "string",
              format: "at-identifier",
              description: "The author's DID",
            },
          },
        },
        output: {
          encoding: "application/json",
          schema: {
            type: "object",
            required: ["actor"],
            properties: {
              actor: {
                type: "ref",
                ref: "lex:fm.teal.alpha.actor.defs#profileView",
              },
            },
          },
        },
      },
    },
  },
  FmTealAlphaActorGetProfiles: {
    lexicon: 1,
    id: "fm.teal.alpha.actor.getProfiles",
    description:
      "This lexicon is in a not officially released state. It is subject to change. | Retrieves the associated profile.",
    defs: {
      main: {
        type: "query",
        parameters: {
          type: "params",
          required: ["actors"],
          properties: {
            actors: {
              type: "array",
              items: {
                type: "string",
                format: "at-identifier",
              },
              description: "Array of actor DIDs",
            },
          },
        },
        output: {
          encoding: "application/json",
          schema: {
            type: "object",
            required: ["actors"],
            properties: {
              actors: {
                type: "array",
                items: {
                  type: "ref",
                  ref: "lex:fm.teal.alpha.actor.defs#miniProfileView",
                },
              },
            },
          },
        },
      },
    },
  },
  FmTealAlphaActorProfile: {
    lexicon: 1,
    id: "fm.teal.alpha.actor.profile",
    defs: {
      main: {
        type: "record",
        description:
          "This lexicon is in a not officially released state. It is subject to change. | A declaration of a teal.fm account profile.",
        key: "literal:self",
        record: {
          type: "object",
          properties: {
            displayName: {
              type: "string",
              maxGraphemes: 64,
              maxLength: 640,
            },
            description: {
              type: "string",
              description: "Free-form profile description text.",
              maxGraphemes: 256,
              maxLength: 2560,
            },
            descriptionFacets: {
              type: "array",
              description:
                "Annotations of text in the profile description (mentions, URLs, hashtags, etc).",
              items: {
                type: "ref",
                ref: "lex:app.bsky.richtext.facet",
              },
            },
            featuredItem: {
              type: "ref",
              description:
                "The user's most recent item featured on their profile.",
              ref: "lex:fm.teal.alpha.actor.profile#featuredItem",
            },
            avatar: {
              type: "blob",
              description:
                "Small image to be displayed next to posts from account. AKA, 'profile picture'",
              accept: ["image/png", "image/jpeg"],
              maxSize: 1000000,
            },
            banner: {
              type: "blob",
              description:
                "Larger horizontal image to display behind profile view.",
              accept: ["image/png", "image/jpeg"],
              maxSize: 1000000,
            },
            createdAt: {
              type: "string",
              format: "datetime",
            },
          },
        },
      },
      featuredItem: {
        type: "object",
        required: ["mbid", "type"],
        properties: {
          mbid: {
            type: "string",
            description: "The Musicbrainz ID of the item",
          },
          type: {
            type: "string",
            description:
              "The type of the item. Must be a valid Musicbrainz type, e.g. album, track, recording, etc.",
          },
        },
      },
    },
  },
  FmTealAlphaActorSearchActors: {
    lexicon: 1,
    id: "fm.teal.alpha.actor.searchActors",
    description:
      "This lexicon is in a not officially released state. It is subject to change. | Searches for actors based on profile contents.",
    defs: {
      main: {
        type: "query",
        parameters: {
          type: "params",
          required: ["q"],
          properties: {
            q: {
              type: "string",
              description: "The search query",
              maxGraphemes: 128,
              maxLength: 640,
            },
            limit: {
              type: "integer",
              description: "The maximum number of actors to return",
              minimum: 1,
              maximum: 25,
            },
            cursor: {
              type: "string",
              description: "Cursor for pagination",
            },
          },
        },
        output: {
          encoding: "application/json",
          schema: {
            type: "object",
            required: ["actors"],
            properties: {
              actors: {
                type: "array",
                items: {
                  type: "ref",
                  ref: "lex:fm.teal.alpha.actor.defs#miniProfileView",
                },
              },
              cursor: {
                type: "string",
                description: "Cursor for pagination",
              },
            },
          },
        },
      },
    },
  },
  FmTealAlphaActorStatus: {
    lexicon: 1,
    id: "fm.teal.alpha.actor.status",
    defs: {
      main: {
        type: "record",
        description:
          "This lexicon is in a not officially released state. It is subject to change. | A declaration of the status of the actor. Only one can be shown at a time. If there are multiple, the latest record should be picked and earlier records should be deleted or tombstoned.",
        key: "literal:self",
        record: {
          type: "object",
          required: ["time", "item"],
          properties: {
            time: {
              type: "string",
              format: "datetime",
              description: "The unix timestamp of when the item was recorded",
            },
            expiry: {
              type: "string",
              format: "datetime",
              description:
                "The unix timestamp of the expiry time of the item. If unavailable, default to 10 minutes past the start time.",
            },
            item: {
              type: "ref",
              ref: "lex:fm.teal.alpha.feed.defs#playView",
            },
          },
        },
      },
    },
  },
  FmTealAlphaFeedDefs: {
    lexicon: 1,
    id: "fm.teal.alpha.feed.defs",
    description:
      "This lexicon is in a not officially released state. It is subject to change. | Misc. items related to feeds.",
    defs: {
      playView: {
        type: "object",
        required: ["trackName", "artists"],
        properties: {
          trackName: {
            type: "string",
            minLength: 1,
            maxLength: 256,
            maxGraphemes: 2560,
            description: "The name of the track",
          },
          trackMbId: {
            type: "string",
            description: "The Musicbrainz ID of the track",
          },
          recordingMbId: {
            type: "string",
            description: "The Musicbrainz recording ID of the track",
          },
          duration: {
            type: "integer",
            description: "The length of the track in seconds",
          },
          artists: {
            type: "array",
            items: {
              type: "ref",
              ref: "lex:fm.teal.alpha.feed.defs#artist",
            },
            description: "Array of artists in order of original appearance.",
          },
          releaseName: {
            type: "string",
            maxLength: 256,
            maxGraphemes: 2560,
            description: "The name of the release/album",
          },
          releaseMbId: {
            type: "string",
            description: "The Musicbrainz release ID",
          },
          isrc: {
            type: "string",
            description: "The ISRC code associated with the recording",
          },
          originUrl: {
            type: "string",
            description: "The URL associated with this track",
          },
          musicServiceBaseDomain: {
            type: "string",
            description:
              "The base domain of the music service. e.g. music.apple.com, tidal.com, spotify.com. Defaults to 'local' if not provided.",
          },
          submissionClientAgent: {
            type: "string",
            maxLength: 256,
            maxGraphemes: 2560,
            description:
              "A user-agent style string specifying the user agent. e.g. tealtracker/0.0.1b (Linux; Android 13; SM-A715F). Defaults to 'manual/unknown' if not provided.",
          },
          playedTime: {
            type: "string",
            format: "datetime",
            description: "The unix timestamp of when the track was played",
          },
        },
      },
      artist: {
        type: "object",
        required: ["artistName"],
        properties: {
          artistName: {
            type: "string",
            minLength: 1,
            maxLength: 256,
            maxGraphemes: 2560,
            description: "The name of the artist",
          },
          artistMbId: {
            type: "string",
            description: "The Musicbrainz ID of the artist",
          },
        },
      },
    },
  },
  FmTealAlphaFeedGetActorFeed: {
    lexicon: 1,
    id: "fm.teal.alpha.feed.getActorFeed",
    description:
      "This lexicon is in a not officially released state. It is subject to change. | Retrieves multiple plays from the index or via an author's DID.",
    defs: {
      main: {
        type: "query",
        parameters: {
          type: "params",
          required: ["authorDID"],
          properties: {
            authorDID: {
              type: "string",
              format: "at-identifier",
              description: "The author's DID for the play",
            },
            cursor: {
              type: "string",
              description: "The cursor to start the query from",
            },
            limit: {
              type: "integer",
              description:
                "The upper limit of tracks to get per request. Default is 20, max is 50.",
            },
          },
        },
        output: {
          encoding: "application/json",
          schema: {
            type: "object",
            required: ["plays"],
            properties: {
              plays: {
                type: "array",
                items: {
                  type: "ref",
                  ref: "lex:fm.teal.alpha.feed.defs#playView",
                },
              },
            },
          },
        },
      },
    },
  },
  FmTealAlphaFeedGetPlay: {
    lexicon: 1,
    id: "fm.teal.alpha.feed.getPlay",
    description:
      "This lexicon is in a not officially released state. It is subject to change. | Retrieves a play given an author DID and record key.",
    defs: {
      main: {
        type: "query",
        parameters: {
          type: "params",
          required: ["authorDID", "rkey"],
          properties: {
            authorDID: {
              type: "string",
              format: "at-identifier",
              description: "The author's DID for the play",
            },
            rkey: {
              type: "string",
              description: "The record key of the play",
            },
          },
        },
        output: {
          encoding: "application/json",
          schema: {
            type: "object",
            required: ["play"],
            properties: {
              play: {
                type: "ref",
                ref: "lex:fm.teal.alpha.feed.defs#playView",
              },
            },
          },
        },
      },
    },
  },
  FmTealAlphaFeedPlay: {
    lexicon: 1,
    id: "fm.teal.alpha.feed.play",
    description:
      "This lexicon is in a not officially released state. It is subject to change. | A declaration of a teal.fm play. Plays are submitted as a result of a user listening to a track. Plays should be marked as tracked when a user has listened to the entire track if it's under 2 minutes long, or half of the track's duration up to 4 minutes, whichever is longest.",
    defs: {
      main: {
        type: "record",
        key: "tid",
        record: {
          type: "object",
          required: ["trackName"],
          properties: {
            trackName: {
              type: "string",
              minLength: 1,
              maxLength: 256,
              maxGraphemes: 2560,
              description: "The name of the track",
            },
            trackMbId: {
              type: "string",
              description: "The Musicbrainz ID of the track",
            },
            recordingMbId: {
              type: "string",
              description: "The Musicbrainz recording ID of the track",
            },
            duration: {
              type: "integer",
              description: "The length of the track in seconds",
            },
            artistNames: {
              type: "array",
              items: {
                type: "string",
                minLength: 1,
                maxLength: 256,
                maxGraphemes: 2560,
              },
              description:
                "Array of artist names in order of original appearance. Prefer using 'artists'.",
            },
            artistMbIds: {
              type: "array",
              items: {
                type: "string",
              },
              description:
                "Array of Musicbrainz artist IDs. Prefer using 'artists'.",
            },
            artists: {
              type: "array",
              items: {
                type: "ref",
                ref: "lex:fm.teal.alpha.feed.defs#artist",
              },
              description: "Array of artists in order of original appearance.",
            },
            releaseName: {
              type: "string",
              maxLength: 256,
              maxGraphemes: 2560,
              description: "The name of the release/album",
            },
            releaseMbId: {
              type: "string",
              description: "The Musicbrainz release ID",
            },
            isrc: {
              type: "string",
              description: "The ISRC code associated with the recording",
            },
            originUrl: {
              type: "string",
              description: "The URL associated with this track",
            },
            musicServiceBaseDomain: {
              type: "string",
              description:
                "The base domain of the music service. e.g. music.apple.com, tidal.com, spotify.com. Defaults to 'local' if unavailable or not provided.",
            },
            submissionClientAgent: {
              type: "string",
              maxLength: 256,
              maxGraphemes: 2560,
              description:
                "A metadata string specifying the user agent where the format is `<app-identifier>/<version> (<kernel/OS-base>; <platform/OS-version>; <device-model>)`. If string is provided, only `app-identifier` and `version` are required. `app-identifier` is recommended to be in reverse dns format. Defaults to 'manual/unknown' if unavailable or not provided.",
            },
            playedTime: {
              type: "string",
              format: "datetime",
              description: "The unix timestamp of when the track was played",
            },
          },
        },
      },
    },
  },
  XyzStatusphereStatus: {
    lexicon: 1,
    id: "xyz.statusphere.status",
    defs: {
      main: {
        type: "record",
        key: "tid",
        record: {
          type: "object",
          required: ["status", "createdAt"],
          properties: {
            status: {
              type: "string",
              minLength: 1,
              maxGraphemes: 1,
              maxLength: 32,
            },
            createdAt: {
              type: "string",
              format: "datetime",
            },
          },
        },
      },
    },
  },
} as const satisfies Record<string, LexiconDoc>;

export const schemas = Object.values(schemaDict);
export const lexicons: Lexicons = new Lexicons(schemas);
export const ids = {
  AppBskyActorProfile: "app.bsky.actor.profile",
  AppBskyRichtextFacet: "app.bsky.richtext.facet",
  FmTealAlphaActorDefs: "fm.teal.alpha.actor.defs",
  FmTealAlphaActorGetProfile: "fm.teal.alpha.actor.getProfile",
  FmTealAlphaActorGetProfiles: "fm.teal.alpha.actor.getProfiles",
  FmTealAlphaActorProfile: "fm.teal.alpha.actor.profile",
  FmTealAlphaActorSearchActors: "fm.teal.alpha.actor.searchActors",
  FmTealAlphaActorStatus: "fm.teal.alpha.actor.status",
  FmTealAlphaFeedDefs: "fm.teal.alpha.feed.defs",
  FmTealAlphaFeedGetActorFeed: "fm.teal.alpha.feed.getActorFeed",
  FmTealAlphaFeedGetPlay: "fm.teal.alpha.feed.getPlay",
  FmTealAlphaFeedPlay: "fm.teal.alpha.feed.play",
  XyzStatusphereStatus: "xyz.statusphere.status",
};
