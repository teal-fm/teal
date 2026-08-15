/**
 * GENERATED CODE - DO NOT MODIFY
 */
import {
  type LexiconDoc,
  Lexicons,
  ValidationError,
  type ValidationResult,
} from '@atproto/lexicon'
import { type $Typed, is$typed, maybe$typed } from './util'

export const schemaDict = {
  AppBskyRichtextFacet: {
    lexicon: 1,
    id: 'app.bsky.richtext.facet',
    defs: {
      main: {
        type: 'object',
        description: 'Annotation of a sub-string within rich text.',
        required: ['index', 'features'],
        properties: {
          index: {
            type: 'ref',
            ref: 'lex:app.bsky.richtext.facet#byteSlice',
          },
          features: {
            type: 'array',
            items: {
              type: 'union',
              refs: [
                'lex:app.bsky.richtext.facet#mention',
                'lex:app.bsky.richtext.facet#link',
                'lex:app.bsky.richtext.facet#tag',
              ],
            },
          },
        },
      },
      mention: {
        type: 'object',
        description:
          "Facet feature for mention of another account. The text is usually a handle, including a '@' prefix, but the facet reference is a DID.",
        required: ['did'],
        properties: {
          did: {
            type: 'string',
            format: 'did',
          },
        },
      },
      link: {
        type: 'object',
        description:
          'Facet feature for a URL. The text URL may have been simplified or truncated, but the facet reference should be a complete URL.',
        required: ['uri'],
        properties: {
          uri: {
            type: 'string',
            format: 'uri',
          },
        },
      },
      tag: {
        type: 'object',
        description:
          "Facet feature for a hashtag. The text usually includes a '#' prefix, but the facet reference should not (except in the case of 'double hash tags').",
        required: ['tag'],
        properties: {
          tag: {
            type: 'string',
            maxLength: 640,
            maxGraphemes: 64,
          },
        },
      },
      byteSlice: {
        type: 'object',
        description:
          'Specifies the sub-string range a facet feature applies to. Start index is inclusive, end index is exclusive. Indices are zero-indexed, counting bytes of the UTF-8 encoded text. NOTE: some languages, like Javascript, use UTF-16 or Unicode codepoints for string slice indexing; in these languages, convert to byte arrays before working with facets.',
        required: ['byteStart', 'byteEnd'],
        properties: {
          byteStart: {
            type: 'integer',
            minimum: 0,
          },
          byteEnd: {
            type: 'integer',
            minimum: 0,
          },
        },
      },
    },
  },
  FmTealActorDefs: {
    lexicon: 1,
    id: 'fm.teal.actor.defs',
    defs: {
      profileView: {
        type: 'object',
        properties: {
          did: {
            type: 'string',
            format: 'did',
            description: 'The decentralized identifier of the actor',
          },
          displayName: {
            type: 'string',
          },
          description: {
            type: 'string',
            description: 'Free-form profile description text.',
          },
          descriptionFacets: {
            type: 'array',
            description:
              'Annotations of text in the profile description (mentions, URLs, hashtags, etc). May be changed to another (backwards compatible) lexicon.',
            items: {
              type: 'ref',
              ref: 'lex:app.bsky.richtext.facet',
            },
          },
          featuredItem: {
            type: 'ref',
            description:
              "The user's most recent item featured on their profile.",
            ref: 'lex:fm.teal.actor.profile#featuredItem',
          },
          avatar: {
            type: 'string',
            format: 'cid',
            description: 'IPLD of the avatar',
          },
          banner: {
            type: 'string',
            format: 'cid',
            description: 'IPLD of the banner image',
          },
          status: {
            type: 'ref',
            ref: 'lex:fm.teal.actor.defs#statusView',
          },
          profileStatus: {
            type: 'ref',
            description:
              "The actor's Teal onboarding state as indexed by the appview.",
            ref: 'lex:fm.teal.actor.profileStatus#main',
          },
          statsDefaultPeriod: {
            type: 'string',
            enum: ['7days', '30days', '90days', '180days', '365days', 'all'],
            description:
              'Default time period for profile listening statistics.',
          },
          createdAt: {
            type: 'string',
            format: 'datetime',
          },
        },
      },
      miniProfileView: {
        type: 'object',
        properties: {
          did: {
            type: 'string',
            format: 'did',
            description: 'The decentralized identifier of the actor',
          },
          displayName: {
            type: 'string',
          },
          handle: {
            type: 'string',
            format: 'handle',
          },
          avatar: {
            type: 'string',
            format: 'cid',
            description: 'IPLD of the avatar',
          },
        },
      },
      statusView: {
        type: 'object',
        description: 'A declaration of the status of the actor.',
        properties: {
          time: {
            type: 'string',
            format: 'datetime',
            description: 'The datetime at which the status was recorded.',
          },
          expiry: {
            type: 'string',
            format: 'datetime',
            description:
              'The datetime after which the status is no longer current.',
          },
          item: {
            type: 'ref',
            ref: 'lex:fm.teal.feed.defs#playView',
          },
        },
      },
    },
  },
  FmTealActorGetProfile: {
    lexicon: 1,
    id: 'fm.teal.actor.getProfile',
    description:
      'This lexicon is in a not officially released state. It is subject to change. | Retrieves a profile for an actor DID or handle.',
    defs: {
      main: {
        type: 'query',
        parameters: {
          type: 'params',
          required: ['actor'],
          properties: {
            actor: {
              type: 'string',
              format: 'at-identifier',
              description: "The actor's DID or handle",
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['actor'],
            properties: {
              actor: {
                type: 'ref',
                ref: 'lex:fm.teal.actor.defs#profileView',
              },
            },
          },
        },
      },
    },
  },
  FmTealActorGetProfiles: {
    lexicon: 1,
    id: 'fm.teal.actor.getProfiles',
    description:
      'This lexicon is in a not officially released state. It is subject to change. | Retrieves the associated profile.',
    defs: {
      main: {
        type: 'query',
        parameters: {
          type: 'params',
          required: ['actors'],
          properties: {
            actors: {
              type: 'array',
              items: {
                type: 'string',
                format: 'at-identifier',
              },
              description: 'Array of actor DIDs or handles',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['actors'],
            properties: {
              actors: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:fm.teal.actor.defs#miniProfileView',
                },
              },
            },
          },
        },
      },
    },
  },
  FmTealActorProfile: {
    lexicon: 1,
    id: 'fm.teal.actor.profile',
    defs: {
      main: {
        type: 'record',
        description:
          'This lexicon is in a not officially released state. It is subject to change. | A declaration of a teal.fm account profile.',
        key: 'literal:self',
        record: {
          type: 'object',
          properties: {
            displayName: {
              type: 'string',
              maxGraphemes: 64,
              maxLength: 640,
            },
            description: {
              type: 'string',
              description: 'Free-form profile description text.',
              maxGraphemes: 256,
              maxLength: 2560,
            },
            descriptionFacets: {
              type: 'array',
              description:
                'Annotations of text in the profile description (mentions, URLs, hashtags, etc).',
              items: {
                type: 'ref',
                ref: 'lex:app.bsky.richtext.facet',
              },
            },
            featuredItem: {
              type: 'ref',
              description:
                "The user's most recent item featured on their profile.",
              ref: 'lex:fm.teal.actor.profile#featuredItem',
            },
            avatar: {
              type: 'blob',
              description:
                "Small image to be displayed next to posts from account. AKA, 'profile picture'",
              accept: ['image/png', 'image/jpeg'],
              maxSize: 1000000,
            },
            banner: {
              type: 'blob',
              description:
                'Larger horizontal image to display behind profile view.',
              accept: ['image/png', 'image/jpeg'],
              maxSize: 1000000,
            },
            statsDefaultPeriod: {
              type: 'string',
              enum: ['7days', '30days', '90days', '180days', '365days', 'all'],
              description:
                'Default time period for profile listening statistics.',
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
            },
          },
        },
      },
      featuredItem: {
        type: 'object',
        required: ['mbid', 'type'],
        properties: {
          mbid: {
            type: 'string',
            format: 'uri',
            description:
              'The MusicBrainz ID URI of the item, formatted as mbid:<uuid>',
          },
          type: {
            type: 'string',
            knownValues: ['artist', 'release', 'recording'],
            description: 'The MusicBrainz entity type of the item.',
          },
        },
      },
    },
  },
  FmTealActorProfileStatus: {
    lexicon: 1,
    id: 'fm.teal.actor.profileStatus',
    defs: {
      main: {
        type: 'record',
        description:
          'This lexicon is in a not officially released state. It is subject to change. | A declaration of the profile status of the actor.',
        key: 'literal:self',
        record: {
          type: 'object',
          required: ['completedOnboarding'],
          properties: {
            completedOnboarding: {
              type: 'string',
              description: 'The onboarding completion status',
              knownValues: [
                'none',
                'profileOnboarding',
                'playOnboarding',
                'complete',
              ],
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
              description: 'The timestamp when this status was created',
            },
            updatedAt: {
              type: 'string',
              format: 'datetime',
              description: 'The timestamp when this status was last updated',
            },
          },
        },
      },
    },
  },
  FmTealActorSearchActors: {
    lexicon: 1,
    id: 'fm.teal.actor.searchActors',
    description:
      'This lexicon is in a not officially released state. It is subject to change. | Searches for actors based on profile contents.',
    defs: {
      main: {
        type: 'query',
        parameters: {
          type: 'params',
          required: ['q'],
          properties: {
            q: {
              type: 'string',
              description: 'The search query',
              maxGraphemes: 128,
              maxLength: 640,
            },
            limit: {
              type: 'integer',
              description: 'The maximum number of actors to return',
              minimum: 1,
              maximum: 25,
            },
            cursor: {
              type: 'string',
              description: 'Cursor for pagination',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['actors'],
            properties: {
              actors: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:fm.teal.actor.defs#miniProfileView',
                },
              },
              cursor: {
                type: 'string',
                description: 'Cursor for pagination',
              },
            },
          },
        },
      },
    },
  },
  FmTealActorStatus: {
    lexicon: 1,
    id: 'fm.teal.actor.status',
    defs: {
      main: {
        type: 'record',
        description:
          'This lexicon is in a not officially released state. It is subject to change. | A declaration of the status of the actor. Only one can be shown at a time. If there are multiple, the latest record should be picked and earlier records should be deleted or tombstoned.',
        key: 'literal:self',
        record: {
          type: 'object',
          required: ['time', 'item'],
          properties: {
            time: {
              type: 'string',
              format: 'datetime',
              description: 'The datetime at which the status was recorded.',
            },
            expiry: {
              type: 'string',
              format: 'datetime',
              description:
                'The datetime after which the status is no longer current. If unavailable, default to 10 minutes after the start time.',
            },
            item: {
              type: 'ref',
              ref: 'lex:fm.teal.feed.defs#playView',
            },
          },
        },
      },
    },
  },
  FmTealFeedDefs: {
    lexicon: 1,
    id: 'fm.teal.feed.defs',
    description:
      'This lexicon is in a not officially released state. It is subject to change. | Misc. items related to feeds.',
    defs: {
      playView: {
        type: 'object',
        required: ['trackName', 'artists'],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
            description: 'The AT URI for this play record',
          },
          cid: {
            type: 'string',
            description: 'The CID for this play record',
          },
          authorDid: {
            type: 'string',
            format: 'did',
            description: 'The DID of the account that authored this play',
          },
          author: {
            type: 'ref',
            ref: 'lex:fm.teal.actor.defs#miniProfileView',
            description:
              'Compact Teal profile metadata for the account that authored this play',
          },
          rkey: {
            type: 'string',
            description: 'The record key for this play',
          },
          trackName: {
            type: 'string',
            minLength: 1,
            maxLength: 256,
            maxGraphemes: 2560,
            description: 'The name of the track',
          },
          trackMbId: {
            type: 'string',
            format: 'uri',
            description:
              'The MusicBrainz ID URI of the track, formatted as mbid:<uuid>',
          },
          recordingMbId: {
            type: 'string',
            format: 'uri',
            description:
              'The MusicBrainz recording ID URI of the track, formatted as mbid:<uuid>',
          },
          duration: {
            type: 'integer',
            description: 'The length of the track in seconds',
          },
          artists: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:fm.teal.feed.defs#artist',
            },
            description: 'Array of artists in order of original appearance.',
          },
          releaseName: {
            type: 'string',
            maxLength: 256,
            maxGraphemes: 2560,
            description: 'The name of the release/album',
          },
          releaseMbId: {
            type: 'string',
            format: 'uri',
            description:
              'The MusicBrainz release ID URI, formatted as mbid:<uuid>',
          },
          isrc: {
            type: 'string',
            description: 'The ISRC code associated with the recording',
          },
          originUri: {
            type: 'string',
            format: 'uri',
            description: 'The exact URI where the listening event originated.',
          },
          musicServiceUri: {
            type: 'string',
            format: 'uri',
            description:
              'The canonical URI identifying the listening surface or music service.',
          },
          submissionClientAgent: {
            type: 'string',
            maxLength: 256,
            maxGraphemes: 2560,
            description:
              "A user-agent style string specifying the user agent. e.g. tealtracker/0.0.1b (Linux; Android 13; SM-A715F). Defaults to 'manual/unknown' if not provided.",
          },
          playedTime: {
            type: 'string',
            format: 'datetime',
            description: 'The datetime at which playback began.',
          },
        },
      },
      artist: {
        type: 'object',
        required: ['artistName'],
        properties: {
          artistName: {
            type: 'string',
            minLength: 1,
            maxLength: 256,
            maxGraphemes: 2560,
            description: 'The name of the artist',
          },
          artistMbId: {
            type: 'string',
            format: 'uri',
            description:
              'The MusicBrainz artist ID URI, formatted as mbid:<uuid>',
          },
        },
      },
    },
  },
  FmTealFeedGetActorFeed: {
    lexicon: 1,
    id: 'fm.teal.feed.getActorFeed',
    description:
      "This lexicon is in a not officially released state. It is subject to change. | Retrieves multiple plays from the index or via an author's DID.",
    defs: {
      main: {
        type: 'query',
        parameters: {
          type: 'params',
          required: ['authorDID'],
          properties: {
            authorDID: {
              type: 'string',
              format: 'did',
              description: "The author's DID for the play",
            },
            cursor: {
              type: 'string',
              description: 'The cursor to start the query from',
            },
            limit: {
              type: 'integer',
              description:
                'The upper limit of tracks to get per request. Default is 20, max is 50.',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['plays'],
            properties: {
              plays: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:fm.teal.feed.defs#playView',
                },
              },
              cursor: {
                type: 'string',
                description: 'Opaque cursor for the next page of plays',
              },
            },
          },
        },
      },
    },
  },
  FmTealFeedGetPlay: {
    lexicon: 1,
    id: 'fm.teal.feed.getPlay',
    description:
      'This lexicon is in a not officially released state. It is subject to change. | Retrieves a play given an author DID and record key.',
    defs: {
      main: {
        type: 'query',
        parameters: {
          type: 'params',
          required: ['authorDID', 'rkey'],
          properties: {
            authorDID: {
              type: 'string',
              format: 'did',
              description: "The author's DID for the play",
            },
            rkey: {
              type: 'string',
              format: 'record-key',
              description: 'The record key of the play',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['play'],
            properties: {
              play: {
                type: 'ref',
                ref: 'lex:fm.teal.feed.defs#playView',
              },
            },
          },
        },
      },
    },
  },
  FmTealFeedPlay: {
    lexicon: 1,
    id: 'fm.teal.feed.play',
    description:
      "This lexicon is in a not officially released state. It is subject to change. | A declaration of a teal.fm play. Plays are submitted as a result of a user listening to a track. Plays should be marked as tracked when a user has listened to the entire track if it's under 2 minutes long, or half of the track's duration up to 4 minutes, whichever is longest.",
    defs: {
      main: {
        type: 'record',
        key: 'tid',
        record: {
          type: 'object',
          required: ['trackName'],
          properties: {
            trackName: {
              type: 'string',
              minLength: 1,
              maxLength: 256,
              maxGraphemes: 2560,
              description: 'The name of the track',
            },
            trackMbId: {
              type: 'string',
              format: 'uri',
              description:
                'The MusicBrainz ID URI of the track, formatted as mbid:<uuid>',
            },
            recordingMbId: {
              type: 'string',
              format: 'uri',
              description:
                'The MusicBrainz recording ID URI of the track, formatted as mbid:<uuid>',
            },
            duration: {
              type: 'integer',
              description: 'The length of the track in seconds',
            },
            artistNames: {
              type: 'array',
              items: {
                type: 'string',
                minLength: 1,
                maxLength: 256,
                maxGraphemes: 2560,
              },
              description:
                "DEPRECATED: USE 'artists' INSTEAD. Array of artist names in order of original appearance.",
            },
            artistMbIds: {
              type: 'array',
              items: {
                type: 'string',
              },
              description:
                "DEPRECATED: USE 'artists' INSTEAD. Array of Musicbrainz artist IDs.",
            },
            artists: {
              type: 'array',
              items: {
                type: 'ref',
                ref: 'lex:fm.teal.feed.defs#artist',
              },
              description: 'Array of artists in order of original appearance.',
            },
            releaseName: {
              type: 'string',
              maxLength: 256,
              maxGraphemes: 2560,
              description: 'The name of the release/album',
            },
            releaseMbId: {
              type: 'string',
              format: 'uri',
              description:
                'The MusicBrainz release ID URI, formatted as mbid:<uuid>',
            },
            isrc: {
              type: 'string',
              description: 'The ISRC code associated with the recording',
            },
            originUri: {
              type: 'string',
              format: 'uri',
              description:
                'The exact URI where the listening event originated.',
            },
            musicServiceUri: {
              type: 'string',
              format: 'uri',
              description:
                'The canonical URI identifying the listening surface or music service.',
            },
            submissionClientAgent: {
              type: 'string',
              maxLength: 256,
              maxGraphemes: 2560,
              description:
                "A metadata string specifying the user agent where the format is `<app-identifier>/<version> (<kernel/OS-base>; <platform/OS-version>; <device-model>)`. If string is provided, only `app-identifier` and `version` are required. `app-identifier` is recommended to be in reverse dns format. Defaults to 'manual/unknown' if unavailable or not provided.",
            },
            playedTime: {
              type: 'string',
              format: 'datetime',
              description: 'The datetime at which playback began.',
            },
            trackDiscriminant: {
              type: 'string',
              maxLength: 128,
              maxGraphemes: 1280,
              description:
                "Distinguishing information for track variants (e.g. 'Acoustic Version', 'Live at Wembley', 'Radio Edit', 'Demo'). Used to differentiate between different versions of the same base track while maintaining grouping capabilities.",
            },
            releaseDiscriminant: {
              type: 'string',
              maxLength: 128,
              maxGraphemes: 1280,
              description:
                "Distinguishing information for release variants (e.g. 'Deluxe Edition', 'Remastered', '2023 Remaster', 'Special Edition'). Used to differentiate between different versions of the same base release while maintaining grouping capabilities.",
            },
          },
        },
      },
    },
  },
  FmTealFeedSocialDefs: {
    lexicon: 1,
    id: 'fm.teal.feed.social.defs',
    description:
      'This lexicon is in a not officially released state. It is subject to change. | Miscellaneous types related to the social feed.',
    defs: {
      trackView: {
        type: 'object',
        required: ['trackName'],
        properties: {
          trackName: {
            type: 'string',
            minLength: 1,
            maxLength: 256,
            maxGraphemes: 2560,
            description: 'The name of the track.',
          },
          trackMbId: {
            type: 'string',
            format: 'uri',
            description:
              'The MusicBrainz ID URI of the track, formatted as mbid:<uuid>.',
          },
          recordingMbId: {
            type: 'string',
            format: 'uri',
            description:
              'The MusicBrainz recording ID URI of the track, formatted as mbid:<uuid>.',
          },
          duration: {
            type: 'integer',
            minimum: 0,
            description: 'The length of the track in seconds.',
          },
          artistNames: {
            type: 'array',
            items: {
              type: 'string',
              minLength: 1,
              maxLength: 256,
              maxGraphemes: 2560,
            },
            description:
              "Array of artist names in order of original appearance. Prefer using 'artists'.",
          },
          artistMbIds: {
            type: 'array',
            items: {
              type: 'string',
            },
            description:
              "DEPRECATED: USE 'artists' INSTEAD. Array of Musicbrainz artist IDs.",
          },
          artists: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:fm.teal.feed.defs#artist',
            },
            description: 'Array of artists in order of original appearance.',
          },
          releaseName: {
            type: 'string',
            maxLength: 256,
            maxGraphemes: 2560,
            description: 'The name of the release or album.',
          },
          releaseMbId: {
            type: 'string',
            format: 'uri',
            description:
              'The MusicBrainz release ID URI, formatted as mbid:<uuid>.',
          },
          isrc: {
            type: 'string',
            description: 'The ISRC code associated with the recording.',
          },
          trackDiscriminant: {
            type: 'string',
            maxLength: 128,
            maxGraphemes: 1280,
            description: 'Distinguishing information for track variants.',
          },
          releaseDiscriminant: {
            type: 'string',
            maxLength: 128,
            maxGraphemes: 1280,
            description: 'Distinguishing information for release variants.',
          },
          originUrl: {
            type: 'string',
            format: 'uri',
            description: 'The URL associated with this track.',
          },
        },
      },
    },
  },
  FmTealFeedSocialLike: {
    lexicon: 1,
    id: 'fm.teal.feed.social.like',
    description:
      "This lexicon is in a not officially released state. It is subject to change. | The action of 'Liking' a Teal.fm post.",
    defs: {
      main: {
        type: 'record',
        description: 'Record containing a like for a teal.fm post.',
        key: 'tid',
        record: {
          type: 'object',
          required: ['subject', 'createdAt'],
          properties: {
            subject: {
              type: 'ref',
              ref: 'lex:com.atproto.repo.strongRef',
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
              description:
                'Client-declared timestamp when this post was originally created.',
            },
          },
        },
      },
    },
  },
  FmTealFeedSocialPlaylist: {
    lexicon: 1,
    id: 'fm.teal.feed.social.playlist',
    description:
      'This lexicon is in a not officially released state. It is subject to change. | A teal.fm playlist, representing a list of tracks.',
    defs: {
      main: {
        type: 'record',
        description: 'Record containing the playlist metadata.',
        key: 'tid',
        record: {
          type: 'object',
          required: ['name', 'createdAt'],
          properties: {
            name: {
              type: 'string',
              description: 'Display name for the playlist, required.',
              minLength: 1,
              maxLength: 50,
            },
            description: {
              type: 'string',
              maxLength: 5000,
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
              description:
                'Client-declared timestamp when this playlist was originally created.',
            },
          },
        },
      },
    },
  },
  FmTealFeedSocialPlaylistItem: {
    lexicon: 1,
    id: 'fm.teal.feed.social.playlistItem',
    description:
      'This lexicon is in a not officially released state. It is subject to change. | A teal.fm playlist item.',
    defs: {
      main: {
        type: 'record',
        description:
          'Record containing a playlist item for a teal.fm playlist.',
        key: 'tid',
        record: {
          type: 'object',
          required: ['subject', 'createdAt', 'track'],
          properties: {
            subject: {
              type: 'ref',
              ref: 'lex:com.atproto.repo.strongRef',
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
              description:
                'Client-declared timestamp when this post was originally created.',
            },
            track: {
              type: 'ref',
              ref: 'lex:fm.teal.feed.social.defs#trackView',
            },
            order: {
              type: 'integer',
              description: 'The order of the track in the playlist',
            },
          },
        },
      },
    },
  },
  FmTealFeedSocialPost: {
    lexicon: 1,
    id: 'fm.teal.feed.social.post',
    description:
      'This lexicon is in a not officially released state. It is subject to change. | Record containing a teal.fm post. Teal.fm posts include a track that is connected to the post, and could have some text. Replies, by default, have the same track as the parent post.',
    defs: {
      main: {
        type: 'record',
        description: 'Record containing a teal.fm post.',
        key: 'tid',
        record: {
          type: 'object',
          required: ['text', 'createdAt'],
          properties: {
            text: {
              type: 'string',
              maxLength: 3000,
              maxGraphemes: 300,
              description:
                'The primary post content. May be an empty string, if there are embeds.',
            },
            trackName: {
              type: 'string',
              minLength: 1,
              maxLength: 256,
              maxGraphemes: 2560,
              description: 'The name of the track',
            },
            trackMbId: {
              type: 'string',
              description: 'The Musicbrainz ID of the track',
            },
            recordingMbId: {
              type: 'string',
              description: 'The Musicbrainz recording ID of the track',
            },
            duration: {
              type: 'integer',
              description: 'The duration of the track in seconds',
            },
            artistNames: {
              type: 'array',
              items: {
                type: 'string',
                minLength: 1,
                maxLength: 256,
                maxGraphemes: 2560,
              },
              description: 'The names of the artists',
            },
            artistMbIds: {
              type: 'array',
              items: {
                type: 'string',
              },
              description: 'The Musicbrainz IDs of the artists',
            },
            releaseName: {
              type: 'string',
              maxLength: 256,
              maxGraphemes: 2560,
              description: 'The name of the release/album',
            },
            releaseMbId: {
              type: 'string',
              description: 'The Musicbrainz ID of the release/album',
            },
            isrc: {
              type: 'string',
              description: 'The ISRC code associated with the recording',
            },
            reply: {
              type: 'ref',
              ref: 'lex:fm.teal.feed.social.post#replyRef',
            },
            facets: {
              type: 'array',
              description:
                'Rich text facets, which may include mentions, links, and other features.',
              items: {
                type: 'ref',
                ref: 'lex:fm.teal.richtext.facet',
              },
            },
            langs: {
              type: 'array',
              description:
                'Indicates human language of post primary text content.',
              maxLength: 3,
              items: {
                type: 'string',
                format: 'language',
              },
            },
            tags: {
              type: 'array',
              description:
                'Additional hashtags, in addition to any included in post text and facets.',
              maxLength: 8,
              items: {
                type: 'string',
                maxLength: 640,
                maxGraphemes: 64,
              },
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
              description:
                'Client-declared timestamp when this post was originally created.',
            },
          },
        },
      },
      replyRef: {
        type: 'object',
        required: ['root', 'parent'],
        properties: {
          root: {
            type: 'ref',
            ref: 'lex:com.atproto.repo.strongRef',
          },
          parent: {
            type: 'ref',
            ref: 'lex:com.atproto.repo.strongRef',
          },
        },
      },
    },
  },
  FmTealFeedSocialRepost: {
    lexicon: 1,
    id: 'fm.teal.feed.social.repost',
    description:
      "This lexicon is in a not officially released state. It is subject to change. | The action of 'Reposting' a Teal.fm post.",
    defs: {
      main: {
        type: 'record',
        description: 'Record containing a repost for a teal.fm post.',
        key: 'tid',
        record: {
          type: 'object',
          required: ['subject', 'createdAt'],
          properties: {
            subject: {
              type: 'ref',
              ref: 'lex:com.atproto.repo.strongRef',
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
              description:
                'Client-declared timestamp when this post was originally created.',
            },
          },
        },
      },
    },
  },
  FmTealGraphFollow: {
    lexicon: 1,
    id: 'fm.teal.graph.follow',
    description:
      'This lexicon is in a not officially released state. It is subject to change. | The action of following another actor on Teal.',
    defs: {
      main: {
        type: 'record',
        description:
          'Record declaring that the repo owner follows another actor.',
        key: 'tid',
        record: {
          type: 'object',
          required: ['subject', 'createdAt'],
          properties: {
            subject: {
              type: 'string',
              format: 'did',
              description: 'DID of the actor being followed.',
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
              description:
                'Client-declared timestamp when this follow was created.',
            },
          },
        },
      },
    },
  },
  FmTealGraphGetFollowers: {
    lexicon: 1,
    id: 'fm.teal.graph.getFollowers',
    description:
      'This lexicon is in a not officially released state. It is subject to change. | Retrieves actors who follow an actor.',
    defs: {
      main: {
        type: 'query',
        parameters: {
          type: 'params',
          required: ['actor'],
          properties: {
            actor: {
              type: 'string',
              format: 'at-identifier',
              description: 'The actor DID or handle.',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50,
            },
            cursor: {
              type: 'string',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['actors'],
            properties: {
              actors: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:fm.teal.actor.defs#miniProfileView',
                },
              },
              cursor: {
                type: 'string',
              },
            },
          },
        },
      },
    },
  },
  FmTealGraphGetFollows: {
    lexicon: 1,
    id: 'fm.teal.graph.getFollows',
    description:
      'This lexicon is in a not officially released state. It is subject to change. | Retrieves actors followed by an actor.',
    defs: {
      main: {
        type: 'query',
        parameters: {
          type: 'params',
          required: ['actor'],
          properties: {
            actor: {
              type: 'string',
              format: 'at-identifier',
              description: 'The actor DID or handle.',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50,
            },
            cursor: {
              type: 'string',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['actors'],
            properties: {
              actors: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:fm.teal.actor.defs#miniProfileView',
                },
              },
              cursor: {
                type: 'string',
              },
            },
          },
        },
      },
    },
  },
  FmTealGraphGetSummary: {
    lexicon: 1,
    id: 'fm.teal.graph.getSummary',
    description:
      'This lexicon is in a not officially released state. It is subject to change. | Retrieves Teal social graph counts and viewer state for an actor.',
    defs: {
      main: {
        type: 'query',
        parameters: {
          type: 'params',
          required: ['actor'],
          properties: {
            actor: {
              type: 'string',
              format: 'at-identifier',
              description: 'The actor DID or handle.',
            },
            viewer: {
              type: 'string',
              format: 'did',
              description: 'Optional viewer DID for follow state.',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['followersCount', 'followsCount'],
            properties: {
              followersCount: {
                type: 'integer',
                minimum: 0,
              },
              followsCount: {
                type: 'integer',
                minimum: 0,
              },
              viewerFollowing: {
                type: 'string',
                format: 'at-uri',
                description:
                  'Follow record URI if the viewer follows the actor.',
              },
            },
          },
        },
      },
    },
  },
  FmTealMusicDefs: {
    lexicon: 1,
    id: 'fm.teal.music.defs',
    defs: {
      artistView: {
        type: 'object',
        required: ['name', 'playCount', 'albums'],
        properties: {
          mbid: {
            type: 'string',
            format: 'uri',
            description: 'MusicBrainz artist ID URI, formatted as mbid:<uuid>',
          },
          name: {
            type: 'string',
            description: 'Artist name',
          },
          playCount: {
            type: 'integer',
            description: 'Total indexed listens for this artist',
          },
          albums: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:fm.teal.music.defs#albumSummary',
            },
          },
        },
      },
      artistListenerView: {
        type: 'object',
        required: ['actor', 'playCount'],
        properties: {
          actor: {
            type: 'ref',
            ref: 'lex:fm.teal.actor.defs#miniProfileView',
            description: 'The listener ranked on this artist leaderboard',
          },
          playCount: {
            type: 'integer',
            description:
              'Number of indexed listens by this actor for the artist',
          },
        },
      },
      albumView: {
        type: 'object',
        required: ['mbid', 'name', 'artistName', 'playCount', 'tracks'],
        properties: {
          mbid: {
            type: 'string',
            format: 'uri',
            description: 'MusicBrainz release ID URI, formatted as mbid:<uuid>',
          },
          name: {
            type: 'string',
            description: 'Release title',
          },
          artistMbid: {
            type: 'string',
            format: 'uri',
            description:
              'MusicBrainz ID URI for a representative release artist',
          },
          artistName: {
            type: 'string',
            description: 'Display name for the release artist',
          },
          playCount: {
            type: 'integer',
            description: 'Total indexed listens for tracks on this release',
          },
          tracks: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:fm.teal.music.defs#trackSummary',
            },
          },
        },
      },
      albumSummary: {
        type: 'object',
        required: ['mbid', 'name', 'artistName', 'playCount'],
        properties: {
          mbid: {
            type: 'string',
            format: 'uri',
          },
          name: {
            type: 'string',
          },
          artistMbid: {
            type: 'string',
            format: 'uri',
          },
          artistName: {
            type: 'string',
          },
          playCount: {
            type: 'integer',
          },
          releaseType: {
            type: 'string',
            knownValues: ['album', 'single', 'ep', 'other'],
          },
        },
      },
      trackSummary: {
        type: 'object',
        required: ['uri', 'name', 'artistName', 'playCount'],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
            description: 'Representative listen URI for opening the track page',
          },
          recordingMbid: {
            type: 'string',
            format: 'uri',
          },
          name: {
            type: 'string',
          },
          artistName: {
            type: 'string',
          },
          playCount: {
            type: 'integer',
          },
        },
      },
    },
  },
  FmTealMusicGetAlbum: {
    lexicon: 1,
    id: 'fm.teal.music.getAlbum',
    defs: {
      main: {
        type: 'query',
        description:
          'Get an indexed release, its tracks, and a page of listens',
        parameters: {
          type: 'params',
          required: ['mbid'],
          properties: {
            mbid: {
              type: 'string',
              format: 'uri',
              description:
                'MusicBrainz release ID URI, formatted as mbid:<uuid>',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 30,
            },
            cursor: {
              type: 'string',
              description: 'Opaque cursor for the next page of listens',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['album', 'plays'],
            properties: {
              album: {
                type: 'ref',
                ref: 'lex:fm.teal.music.defs#albumView',
              },
              plays: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:fm.teal.feed.defs#playView',
                },
              },
              cursor: {
                type: 'string',
                description: 'Opaque cursor for the next page of listens',
              },
            },
          },
        },
      },
    },
  },
  FmTealMusicGetArtist: {
    lexicon: 1,
    id: 'fm.teal.music.getArtist',
    defs: {
      main: {
        type: 'query',
        description: 'Get an indexed artist and their release discography',
        parameters: {
          type: 'params',
          properties: {
            mbid: {
              type: 'string',
              format: 'uri',
              description:
                'MusicBrainz artist ID URI, formatted as mbid:<uuid>',
            },
            name: {
              type: 'string',
              description:
                'Artist name fallback when no MusicBrainz ID is available',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['artist'],
            properties: {
              artist: {
                type: 'ref',
                ref: 'lex:fm.teal.music.defs#artistView',
              },
            },
          },
        },
      },
    },
  },
  FmTealMusicGetArtistListeners: {
    lexicon: 1,
    id: 'fm.teal.music.getArtistListeners',
    defs: {
      main: {
        type: 'query',
        description:
          'Get listeners ranked by indexed listen count for an artist',
        parameters: {
          type: 'params',
          properties: {
            mbid: {
              type: 'string',
              format: 'uri',
              description:
                'MusicBrainz artist ID URI, formatted as mbid:<uuid>',
            },
            name: {
              type: 'string',
              description:
                'Artist name fallback when no MusicBrainz ID is available',
            },
            period: {
              type: 'string',
              enum: ['all', '30days', '7days'],
              default: 'all',
              description: 'Time period for the leaderboard',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50,
              description: 'Number of listeners to return',
            },
            cursor: {
              type: 'string',
              description: 'Pagination cursor',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['listeners'],
            properties: {
              listeners: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:fm.teal.music.defs#artistListenerView',
                },
              },
              cursor: {
                type: 'string',
                description: 'Next page cursor',
              },
            },
          },
        },
      },
    },
  },
  FmTealRichtextFacet: {
    lexicon: 1,
    id: 'fm.teal.richtext.facet',
    defs: {
      main: {
        type: 'object',
        description: 'Annotation of a sub-string within rich text.',
        required: ['index', 'features'],
        properties: {
          index: {
            type: 'ref',
            ref: 'lex:app.bsky.richtext.facet#byteSlice',
          },
          features: {
            type: 'array',
            items: {
              type: 'union',
              refs: [
                'lex:app.bsky.richtext.facet#mention',
                'lex:app.bsky.richtext.facet#link',
              ],
            },
          },
        },
      },
    },
  },
  FmTealSearchDefs: {
    lexicon: 1,
    id: 'fm.teal.search.defs',
    defs: {
      songResult: {
        type: 'object',
        required: ['uri', 'trackName', 'artistName', 'playCount'],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
            description: 'Representative indexed play URI for this song',
          },
          trackName: {
            type: 'string',
            description: 'Track name',
          },
          artistName: {
            type: 'string',
            description: 'Display-ready artist credit',
          },
          releaseName: {
            type: 'string',
            description: 'Release or album name',
          },
          releaseMbId: {
            type: 'string',
            format: 'uri',
            description: 'MusicBrainz release ID URI, formatted as mbid:<uuid>',
          },
          recordingMbId: {
            type: 'string',
            format: 'uri',
            description:
              'MusicBrainz recording ID URI, formatted as mbid:<uuid>',
          },
          playCount: {
            type: 'integer',
            description: 'Number of indexed plays for this song',
          },
        },
      },
    },
  },
  FmTealSearchGetResults: {
    lexicon: 1,
    id: 'fm.teal.search.getResults',
    description: 'Search indexed Teal listeners and music metadata.',
    defs: {
      main: {
        type: 'query',
        parameters: {
          type: 'params',
          required: ['q'],
          properties: {
            q: {
              type: 'string',
              description: 'Search query',
              maxGraphemes: 128,
              maxLength: 640,
            },
            limit: {
              type: 'integer',
              description: 'Maximum results per category',
              minimum: 1,
              maximum: 25,
              default: 8,
            },
            actor: {
              type: 'string',
              format: 'did',
              description: 'Only return music listened to by this actor',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['users', 'songs', 'artists', 'albums'],
            properties: {
              users: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:fm.teal.actor.defs#miniProfileView',
                },
              },
              songs: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:fm.teal.search.defs#songResult',
                },
              },
              artists: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:fm.teal.stats.defs#artistView',
                },
              },
              albums: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:fm.teal.stats.defs#releaseView',
                },
              },
            },
          },
        },
      },
    },
  },
  FmTealStatsDefs: {
    lexicon: 1,
    id: 'fm.teal.stats.defs',
    defs: {
      artistView: {
        type: 'object',
        properties: {
          mbid: {
            type: 'string',
            format: 'uri',
            description: 'MusicBrainz artist ID URI, formatted as mbid:<uuid>',
          },
          name: {
            type: 'string',
            description: 'Artist name',
          },
          playCount: {
            type: 'integer',
            description: 'Total number of plays for this artist',
          },
        },
      },
      releaseView: {
        type: 'object',
        properties: {
          mbid: {
            type: 'string',
            format: 'uri',
            description: 'MusicBrainz release ID URI, formatted as mbid:<uuid>',
          },
          name: {
            type: 'string',
            description: 'Release/album name',
          },
          playCount: {
            type: 'integer',
            description: 'Total number of plays for this release',
          },
        },
      },
      recordingView: {
        type: 'object',
        properties: {
          mbid: {
            type: 'string',
            format: 'uri',
            description:
              'MusicBrainz recording ID URI, formatted as mbid:<uuid>',
          },
          name: {
            type: 'string',
            description: 'Recording/track name',
          },
          playCount: {
            type: 'integer',
            description: 'Total number of plays for this recording',
          },
        },
      },
    },
  },
  FmTealStatsGetLatest: {
    lexicon: 1,
    id: 'fm.teal.stats.getLatest',
    defs: {
      main: {
        type: 'query',
        description: 'Get latest plays globally',
        parameters: {
          type: 'params',
          properties: {
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50,
              description: 'Number of latest plays to return',
            },
            cursor: {
              type: 'string',
              description: 'Opaque cursor for the next page of plays',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['plays'],
            properties: {
              plays: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:fm.teal.feed.defs#playView',
                },
              },
              cursor: {
                type: 'string',
                description: 'Opaque cursor for the next page of plays',
              },
            },
          },
        },
      },
    },
  },
  FmTealStatsGetTopArtists: {
    lexicon: 1,
    id: 'fm.teal.stats.getTopArtists',
    description: 'Get top artists by play count',
    defs: {
      main: {
        type: 'query',
        parameters: {
          type: 'params',
          properties: {
            period: {
              type: 'string',
              enum: ['all', '30days', '7days'],
              default: 'all',
              description: 'Time period for top artists',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50,
              description: 'Number of artists to return',
            },
            cursor: {
              type: 'string',
              description: 'Pagination cursor',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['artists'],
            properties: {
              artists: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:fm.teal.stats.defs#artistView',
                },
              },
              cursor: {
                type: 'string',
                description: 'Next page cursor',
              },
            },
          },
        },
      },
    },
  },
  FmTealStatsGetTopReleases: {
    lexicon: 1,
    id: 'fm.teal.stats.getTopReleases',
    description: 'Get top releases/albums by play count',
    defs: {
      main: {
        type: 'query',
        parameters: {
          type: 'params',
          properties: {
            period: {
              type: 'string',
              enum: ['all', '30days', '7days'],
              default: 'all',
              description: 'Time period for top releases',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50,
              description: 'Number of releases to return',
            },
            cursor: {
              type: 'string',
              description: 'Pagination cursor',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['releases'],
            properties: {
              releases: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:fm.teal.stats.defs#releaseView',
                },
              },
              cursor: {
                type: 'string',
                description: 'Next page cursor',
              },
            },
          },
        },
      },
    },
  },
  FmTealStatsGetUserTopArtists: {
    lexicon: 1,
    id: 'fm.teal.stats.getUserTopArtists',
    description: "Get a user's top artists by play count",
    defs: {
      main: {
        type: 'query',
        parameters: {
          type: 'params',
          required: ['actor'],
          properties: {
            actor: {
              type: 'string',
              format: 'at-identifier',
              description: "The user's DID or handle",
            },
            period: {
              type: 'string',
              enum: ['7days', '30days', '90days', '180days', '365days', 'all'],
              default: '90days',
              description: 'Time period for top artists',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50,
              description: 'Number of artists to return',
            },
            cursor: {
              type: 'string',
              description: 'Pagination cursor',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['artists'],
            properties: {
              artists: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:fm.teal.stats.defs#artistView',
                },
              },
              cursor: {
                type: 'string',
                description: 'Next page cursor',
              },
            },
          },
        },
      },
    },
  },
  FmTealStatsGetUserTopRecordings: {
    lexicon: 1,
    id: 'fm.teal.stats.getUserTopRecordings',
    description: "Get a user's top recordings/tracks by play count",
    defs: {
      main: {
        type: 'query',
        parameters: {
          type: 'params',
          required: ['actor'],
          properties: {
            actor: {
              type: 'string',
              format: 'at-identifier',
              description: "The user's DID or handle",
            },
            period: {
              type: 'string',
              enum: ['7days', '30days', '90days', '180days', '365days', 'all'],
              default: '90days',
              description: 'Time period for top recordings',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50,
              description: 'Number of recordings to return',
            },
            cursor: {
              type: 'string',
              description: 'Pagination cursor',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['recordings'],
            properties: {
              recordings: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:fm.teal.stats.defs#recordingView',
                },
              },
              cursor: {
                type: 'string',
                description: 'Next page cursor',
              },
            },
          },
        },
      },
    },
  },
  FmTealStatsGetUserTopReleases: {
    lexicon: 1,
    id: 'fm.teal.stats.getUserTopReleases',
    description: "Get a user's top releases/albums by play count",
    defs: {
      main: {
        type: 'query',
        parameters: {
          type: 'params',
          required: ['actor'],
          properties: {
            actor: {
              type: 'string',
              format: 'at-identifier',
              description: "The user's DID or handle",
            },
            period: {
              type: 'string',
              enum: ['7days', '30days', '90days', '180days', '365days', 'all'],
              default: '90days',
              description: 'Time period for top releases',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50,
              description: 'Number of releases to return',
            },
            cursor: {
              type: 'string',
              description: 'Pagination cursor',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['releases'],
            properties: {
              releases: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:fm.teal.stats.defs#releaseView',
                },
              },
              cursor: {
                type: 'string',
                description: 'Next page cursor',
              },
            },
          },
        },
      },
    },
  },
} as const satisfies Record<string, LexiconDoc>
export const schemas = Object.values(schemaDict) satisfies LexiconDoc[]
export const lexicons: Lexicons = new Lexicons(schemas)

export function validate<T extends { $type: string }>(
  v: unknown,
  id: string,
  hash: string,
  requiredType: true,
): ValidationResult<T>
export function validate<T extends { $type?: string }>(
  v: unknown,
  id: string,
  hash: string,
  requiredType?: false,
): ValidationResult<T>
export function validate(
  v: unknown,
  id: string,
  hash: string,
  requiredType?: boolean,
): ValidationResult {
  return (requiredType ? is$typed : maybe$typed)(v, id, hash)
    ? lexicons.validate(`${id}#${hash}`, v)
    : {
        success: false,
        error: new ValidationError(
          `Must be an object with "${hash === 'main' ? id : `${id}#${hash}`}" $type property`,
        ),
      }
}

export const ids = {
  AppBskyRichtextFacet: 'app.bsky.richtext.facet',
  FmTealActorDefs: 'fm.teal.actor.defs',
  FmTealActorGetProfile: 'fm.teal.actor.getProfile',
  FmTealActorGetProfiles: 'fm.teal.actor.getProfiles',
  FmTealActorProfile: 'fm.teal.actor.profile',
  FmTealActorProfileStatus: 'fm.teal.actor.profileStatus',
  FmTealActorSearchActors: 'fm.teal.actor.searchActors',
  FmTealActorStatus: 'fm.teal.actor.status',
  FmTealFeedDefs: 'fm.teal.feed.defs',
  FmTealFeedGetActorFeed: 'fm.teal.feed.getActorFeed',
  FmTealFeedGetPlay: 'fm.teal.feed.getPlay',
  FmTealFeedPlay: 'fm.teal.feed.play',
  FmTealFeedSocialDefs: 'fm.teal.feed.social.defs',
  FmTealFeedSocialLike: 'fm.teal.feed.social.like',
  FmTealFeedSocialPlaylist: 'fm.teal.feed.social.playlist',
  FmTealFeedSocialPlaylistItem: 'fm.teal.feed.social.playlistItem',
  FmTealFeedSocialPost: 'fm.teal.feed.social.post',
  FmTealFeedSocialRepost: 'fm.teal.feed.social.repost',
  FmTealGraphFollow: 'fm.teal.graph.follow',
  FmTealGraphGetFollowers: 'fm.teal.graph.getFollowers',
  FmTealGraphGetFollows: 'fm.teal.graph.getFollows',
  FmTealGraphGetSummary: 'fm.teal.graph.getSummary',
  FmTealMusicDefs: 'fm.teal.music.defs',
  FmTealMusicGetAlbum: 'fm.teal.music.getAlbum',
  FmTealMusicGetArtist: 'fm.teal.music.getArtist',
  FmTealMusicGetArtistListeners: 'fm.teal.music.getArtistListeners',
  FmTealRichtextFacet: 'fm.teal.richtext.facet',
  FmTealSearchDefs: 'fm.teal.search.defs',
  FmTealSearchGetResults: 'fm.teal.search.getResults',
  FmTealStatsDefs: 'fm.teal.stats.defs',
  FmTealStatsGetLatest: 'fm.teal.stats.getLatest',
  FmTealStatsGetTopArtists: 'fm.teal.stats.getTopArtists',
  FmTealStatsGetTopReleases: 'fm.teal.stats.getTopReleases',
  FmTealStatsGetUserTopArtists: 'fm.teal.stats.getUserTopArtists',
  FmTealStatsGetUserTopRecordings: 'fm.teal.stats.getUserTopRecordings',
  FmTealStatsGetUserTopReleases: 'fm.teal.stats.getUserTopReleases',
} as const
