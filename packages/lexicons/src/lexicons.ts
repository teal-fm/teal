/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { LexiconDoc, Lexicons } from '@atproto/lexicon'

export const schemaDict = {
  FmTealAlphaActorDefs: {
    lexicon: 1,
    id: 'fm.teal.alpha.actor.defs',
    defs: {
      profileView: {
        type: 'object',
        properties: {
          did: {
            type: 'string',
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
            ref: 'lex:fm.teal.alpha.actor.profile#featuredItem',
          },
          avatar: {
            type: 'string',
            description: 'IPLD of the avatar',
          },
          banner: {
            type: 'string',
            description: 'IPLD of the banner image',
          },
          status: {
            type: 'ref',
            ref: 'lex:fm.teal.alpha.actor.defs#statusView',
          },
          profileStatus: {
            type: 'ref',
            description:
              "The actor's Teal onboarding state as indexed by the appview.",
            ref: 'lex:fm.teal.alpha.actor.profileStatus',
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
            description: 'The decentralized identifier of the actor',
          },
          displayName: {
            type: 'string',
          },
          handle: {
            type: 'string',
          },
          avatar: {
            type: 'string',
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
            description: 'The unix timestamp of when the item was recorded',
          },
          expiry: {
            type: 'string',
            format: 'datetime',
            description:
              'The unix timestamp of the expiry time of the item. If unavailable, default to 10 minutes past the start time.',
          },
          item: {
            type: 'ref',
            ref: 'lex:fm.teal.alpha.feed.defs#playView',
          },
        },
      },
    },
  },
  FmTealAlphaActorGetProfile: {
    lexicon: 1,
    id: 'fm.teal.alpha.actor.getProfile',
    description:
      'This lexicon is in a not officially released state. It is subject to change. | Retrieves a play given an author DID and record key.',
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
              description: "The author's DID",
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
                ref: 'lex:fm.teal.alpha.actor.defs#profileView',
              },
            },
          },
        },
      },
    },
  },
  FmTealAlphaActorGetProfiles: {
    lexicon: 1,
    id: 'fm.teal.alpha.actor.getProfiles',
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
              description: 'Array of actor DIDs',
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
                  ref: 'lex:fm.teal.alpha.actor.defs#miniProfileView',
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
    id: 'fm.teal.alpha.actor.profile',
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
              ref: 'lex:fm.teal.alpha.actor.profile#featuredItem',
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
            description:
              'The type of the item. Must be a valid Musicbrainz type, e.g. album, track, recording, etc.',
          },
        },
      },
    },
  },
  FmTealAlphaActorProfileStatus: {
    lexicon: 1,
    id: 'fm.teal.alpha.actor.profileStatus',
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
  FmTealAlphaActorSearchActors: {
    lexicon: 1,
    id: 'fm.teal.alpha.actor.searchActors',
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
                  ref: 'lex:fm.teal.alpha.actor.defs#miniProfileView',
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
  FmTealAlphaActorStatus: {
    lexicon: 1,
    id: 'fm.teal.alpha.actor.status',
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
              description:
                'The RFC 3339 formatted time of when the item was recorded',
            },
            expiry: {
              type: 'string',
              format: 'datetime',
              description:
                'The RFC 3339 formatted time of the expiry time of the item. If unavailable, default to 10 minutes past the start time.',
            },
            item: {
              type: 'ref',
              ref: 'lex:fm.teal.alpha.feed.defs#playView',
            },
          },
        },
      },
    },
  },
  FmTealAlphaFeedDefs: {
    lexicon: 1,
    id: 'fm.teal.alpha.feed.defs',
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
            ref: 'lex:fm.teal.alpha.actor.defs#miniProfileView',
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
              ref: 'lex:fm.teal.alpha.feed.defs#artist',
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
          originUrl: {
            type: 'string',
            description: 'The URL associated with this track',
          },
          musicServiceBaseDomain: {
            type: 'string',
            description:
              "The base domain of the music service. e.g. music.apple.com, tidal.com, spotify.com. Defaults to 'local' if not provided.",
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
            description: 'The unix timestamp of when the track was played',
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
  FmTealAlphaFeedGetActorFeed: {
    lexicon: 1,
    id: 'fm.teal.alpha.feed.getActorFeed',
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
              format: 'at-identifier',
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
                  ref: 'lex:fm.teal.alpha.feed.defs#playView',
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
  FmTealAlphaFeedGetPlay: {
    lexicon: 1,
    id: 'fm.teal.alpha.feed.getPlay',
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
              format: 'at-identifier',
              description: "The author's DID for the play",
            },
            rkey: {
              type: 'string',
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
                ref: 'lex:fm.teal.alpha.feed.defs#playView',
              },
            },
          },
        },
      },
    },
  },
  FmTealAlphaFeedPlay: {
    lexicon: 1,
    id: 'fm.teal.alpha.feed.play',
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
                ref: 'lex:fm.teal.alpha.feed.defs#artist',
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
            originUrl: {
              type: 'string',
              description: 'The URL associated with this track',
            },
            musicServiceBaseDomain: {
              type: 'string',
              description:
                "The base domain of the music service. e.g. music.apple.com, tidal.com, spotify.com. Defaults to 'local' if unavailable or not provided.",
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
              description: 'The unix timestamp of when the track was played',
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
  FmTealAlphaFeedSocialBadge: {
    lexicon: 1,
    id: 'fm.teal.alpha.feed.social.badge',
    description:
      'This lexicon is in a not officially released state. It is subject to change. | A teal.fm badge definition.',
    defs: {
      main: {
        type: 'record',
        description:
          'Record containing badge metadata that can be assigned to actors.',
        key: 'tid',
        record: {
          type: 'object',
          required: [
            'name',
            'description',
            'image',
            'creator',
            'type',
            'createdAt',
          ],
          properties: {
            name: {
              type: 'string',
              description: 'Display name for the badge.',
              minLength: 1,
              maxLength: 100,
              maxGraphemes: 100,
            },
            description: {
              type: 'string',
              description: 'Description of what the badge represents.',
              minLength: 1,
              maxLength: 5000,
              maxGraphemes: 500,
            },
            descriptionFacets: {
              type: 'array',
              description: 'Annotations of text in the badge description.',
              items: {
                type: 'ref',
                ref: 'lex:fm.teal.alpha.richtext.facet',
              },
            },
            image: {
              type: 'blob',
              description: 'Image displayed for the badge.',
              accept: ['image/png', 'image/jpeg'],
              maxSize: 1000000,
            },
            creator: {
              type: 'string',
              format: 'did',
              description:
                'DID of the actor who created this badge definition.',
            },
            type: {
              type: 'ref',
              ref: 'lex:fm.teal.alpha.feed.social.defs#badgeType',
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
              description:
                'Client-declared timestamp when this badge was originally created.',
            },
          },
        },
      },
    },
  },
  FmTealAlphaFeedSocialBadgeAssignment: {
    lexicon: 1,
    id: 'fm.teal.alpha.feed.social.badgeAssignment',
    description:
      'This lexicon is in a not officially released state. It is subject to change. | A teal.fm badge assignment.',
    defs: {
      main: {
        type: 'record',
        description: 'Record assigning a badge to an actor.',
        key: 'tid',
        record: {
          type: 'object',
          required: ['badge', 'assignee', 'assigner', 'createdAt'],
          properties: {
            badge: {
              type: 'ref',
              ref: 'lex:com.atproto.repo.strongRef',
              description:
                'Strong reference to the badge definition being assigned.',
            },
            assignee: {
              type: 'string',
              format: 'did',
              description: 'DID of the actor receiving the badge.',
            },
            assigner: {
              type: 'string',
              format: 'did',
              description: 'DID of the actor assigning the badge.',
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
              description:
                'Client-declared timestamp when this badge assignment was originally created.',
            },
          },
        },
      },
    },
  },
  FmTealAlphaFeedSocialDefs: {
    lexicon: 1,
    id: 'fm.teal.alpha.feed.social.defs',
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
              ref: 'lex:fm.teal.alpha.feed.defs#artist',
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
      badgeType: {
        type: 'string',
        description: 'The category of badge.',
        knownValues: ['verification', 'listeningParty', 'achievement'],
      },
    },
  },
  FmTealAlphaFeedSocialLike: {
    lexicon: 1,
    id: 'fm.teal.alpha.feed.social.like',
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
              description: 'Strong reference to the record being liked.',
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
              description:
                'Client-declared timestamp when this like was originally created.',
            },
          },
        },
      },
    },
  },
  FmTealAlphaFeedSocialPlaylist: {
    lexicon: 1,
    id: 'fm.teal.alpha.feed.social.playlist',
    description:
      'This lexicon is in a not officially released state. It is subject to change. | A teal.fm playlist, representing a list of tracks.',
    defs: {
      main: {
        type: 'record',
        description: 'Record containing the playlist metadata.',
        key: 'tid',
        record: {
          type: 'object',
          required: ['name', 'authors', 'createdAt'],
          properties: {
            name: {
              type: 'string',
              description: 'Display name for the playlist, required.',
              minLength: 1,
              maxLength: 100,
              maxGraphemes: 100,
            },
            description: {
              type: 'string',
              description: 'Free-form playlist description text.',
              maxLength: 5000,
              maxGraphemes: 500,
            },
            descriptionFacets: {
              type: 'array',
              description: 'Annotations of text in the playlist description.',
              items: {
                type: 'ref',
                ref: 'lex:fm.teal.alpha.richtext.facet',
              },
            },
            authors: {
              type: 'array',
              description:
                "DIDs of actors who can author playlist items for this playlist. Include the playlist record author. Appviews may attribute playlist items to this playlist when the item's repo author appears in this list.",
              minLength: 1,
              maxLength: 100,
              items: {
                type: 'string',
                format: 'did',
              },
            },
            cover: {
              type: 'blob',
              description: 'Optional image displayed for the playlist.',
              accept: ['image/png', 'image/jpeg'],
              maxSize: 1000000,
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
  FmTealAlphaFeedSocialPlaylistItem: {
    lexicon: 1,
    id: 'fm.teal.alpha.feed.social.playlistItem',
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
          required: ['subject', 'track', 'createdAt'],
          properties: {
            subject: {
              type: 'ref',
              ref: 'lex:com.atproto.repo.strongRef',
              description:
                'Strong reference to the playlist this item belongs to.',
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
              description:
                'Client-declared timestamp when this playlist item was originally created.',
            },
            track: {
              type: 'ref',
              ref: 'lex:fm.teal.alpha.feed.social.defs#trackView',
              description: 'The track added to the playlist.',
            },
            order: {
              type: 'integer',
              minimum: 0,
              description: 'The order of the track in the playlist.',
            },
          },
        },
      },
    },
  },
  FmTealAlphaFeedSocialPost: {
    lexicon: 1,
    id: 'fm.teal.alpha.feed.social.post',
    description:
      'This lexicon is in a not officially released state. It is subject to change. | Record containing a teal.fm post. Teal.fm posts include a track that is connected to the post, and could have some text. Replies, by default, have the same track as the parent post.',
    defs: {
      main: {
        type: 'record',
        description: 'Record containing a teal.fm post.',
        key: 'tid',
        record: {
          type: 'object',
          required: ['text', 'track', 'createdAt'],
          properties: {
            text: {
              type: 'string',
              maxLength: 3000,
              maxGraphemes: 300,
              description:
                'The primary post content. May be an empty string, if there are embeds.',
            },
            track: {
              type: 'ref',
              ref: 'lex:fm.teal.alpha.feed.social.defs#trackView',
              description: 'The track associated with this post.',
            },
            reply: {
              type: 'ref',
              ref: 'lex:fm.teal.alpha.feed.social.post#replyRef',
            },
            facets: {
              type: 'array',
              description:
                'Rich text facets, which may include mentions, links, and other features.',
              items: {
                type: 'ref',
                ref: 'lex:fm.teal.alpha.richtext.facet',
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
  FmTealAlphaFeedSocialRepost: {
    lexicon: 1,
    id: 'fm.teal.alpha.feed.social.repost',
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
              description: 'Strong reference to the record being reposted.',
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
              description:
                'Client-declared timestamp when this repost was originally created.',
            },
          },
        },
      },
    },
  },
  FmTealAlphaGraphFollow: {
    lexicon: 1,
    id: 'fm.teal.alpha.graph.follow',
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
  FmTealAlphaGraphGetFollowers: {
    lexicon: 1,
    id: 'fm.teal.alpha.graph.getFollowers',
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
                  ref: 'lex:fm.teal.alpha.actor.defs#miniProfileView',
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
  FmTealAlphaGraphGetFollows: {
    lexicon: 1,
    id: 'fm.teal.alpha.graph.getFollows',
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
                  ref: 'lex:fm.teal.alpha.actor.defs#miniProfileView',
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
  FmTealAlphaGraphGetSummary: {
    lexicon: 1,
    id: 'fm.teal.alpha.graph.getSummary',
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
  FmTealAlphaMusicDefs: {
    lexicon: 1,
    id: 'fm.teal.alpha.music.defs',
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
              ref: 'lex:fm.teal.alpha.music.defs#albumSummary',
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
            ref: 'lex:fm.teal.alpha.actor.defs#miniProfileView',
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
              ref: 'lex:fm.teal.alpha.music.defs#trackSummary',
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
  FmTealAlphaMusicGetAlbum: {
    lexicon: 1,
    id: 'fm.teal.alpha.music.getAlbum',
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
                ref: 'lex:fm.teal.alpha.music.defs#albumView',
              },
              plays: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:fm.teal.alpha.feed.defs#playView',
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
  FmTealAlphaMusicGetArtist: {
    lexicon: 1,
    id: 'fm.teal.alpha.music.getArtist',
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
                ref: 'lex:fm.teal.alpha.music.defs#artistView',
              },
            },
          },
        },
      },
    },
  },
  FmTealAlphaMusicGetArtistListeners: {
    lexicon: 1,
    id: 'fm.teal.alpha.music.getArtistListeners',
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
                  ref: 'lex:fm.teal.alpha.music.defs#artistListenerView',
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
  FmTealAlphaRichtextFacet: {
    lexicon: 1,
    id: 'fm.teal.alpha.richtext.facet',
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
  FmTealAlphaSearchDefs: {
    lexicon: 1,
    id: 'fm.teal.alpha.search.defs',
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
          playCount: {
            type: 'integer',
            description: 'Number of indexed plays for this song',
          },
        },
      },
    },
  },
  FmTealAlphaSearchGetResults: {
    lexicon: 1,
    id: 'fm.teal.alpha.search.getResults',
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
                  ref: 'lex:fm.teal.alpha.actor.defs#miniProfileView',
                },
              },
              songs: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:fm.teal.alpha.search.defs#songResult',
                },
              },
              artists: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:fm.teal.alpha.stats.defs#artistView',
                },
              },
              albums: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:fm.teal.alpha.stats.defs#releaseView',
                },
              },
            },
          },
        },
      },
    },
  },
  FmTealAlphaStatsDefs: {
    lexicon: 1,
    id: 'fm.teal.alpha.stats.defs',
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
  FmTealAlphaStatsGetLatest: {
    lexicon: 1,
    id: 'fm.teal.alpha.stats.getLatest',
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
                  ref: 'lex:fm.teal.alpha.feed.defs#playView',
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
  FmTealAlphaStatsGetTopArtists: {
    lexicon: 1,
    id: 'fm.teal.alpha.stats.getTopArtists',
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
                  ref: 'lex:fm.teal.alpha.stats.defs#artistView',
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
  FmTealAlphaStatsGetTopReleases: {
    lexicon: 1,
    id: 'fm.teal.alpha.stats.getTopReleases',
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
                  ref: 'lex:fm.teal.alpha.stats.defs#releaseView',
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
  FmTealAlphaStatsGetUserTopArtists: {
    lexicon: 1,
    id: 'fm.teal.alpha.stats.getUserTopArtists',
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
              enum: ['30days', '7days'],
              default: '30days',
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
                  ref: 'lex:fm.teal.alpha.stats.defs#artistView',
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
  FmTealAlphaStatsGetUserTopReleases: {
    lexicon: 1,
    id: 'fm.teal.alpha.stats.getUserTopReleases',
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
              enum: ['30days', '7days'],
              default: '30days',
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
                  ref: 'lex:fm.teal.alpha.stats.defs#releaseView',
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
} as const satisfies Record<string, LexiconDoc>

export const schemas = Object.values(schemaDict)
export const lexicons: Lexicons = new Lexicons(schemas)
export const ids = {
  FmTealAlphaActorDefs: 'fm.teal.alpha.actor.defs',
  FmTealAlphaActorGetProfile: 'fm.teal.alpha.actor.getProfile',
  FmTealAlphaActorGetProfiles: 'fm.teal.alpha.actor.getProfiles',
  FmTealAlphaActorProfile: 'fm.teal.alpha.actor.profile',
  FmTealAlphaActorProfileStatus: 'fm.teal.alpha.actor.profileStatus',
  FmTealAlphaActorSearchActors: 'fm.teal.alpha.actor.searchActors',
  FmTealAlphaActorStatus: 'fm.teal.alpha.actor.status',
  FmTealAlphaFeedDefs: 'fm.teal.alpha.feed.defs',
  FmTealAlphaFeedGetActorFeed: 'fm.teal.alpha.feed.getActorFeed',
  FmTealAlphaFeedGetPlay: 'fm.teal.alpha.feed.getPlay',
  FmTealAlphaFeedPlay: 'fm.teal.alpha.feed.play',
  FmTealAlphaFeedSocialBadge: 'fm.teal.alpha.feed.social.badge',
  FmTealAlphaFeedSocialBadgeAssignment:
    'fm.teal.alpha.feed.social.badgeAssignment',
  FmTealAlphaFeedSocialDefs: 'fm.teal.alpha.feed.social.defs',
  FmTealAlphaFeedSocialLike: 'fm.teal.alpha.feed.social.like',
  FmTealAlphaFeedSocialPlaylist: 'fm.teal.alpha.feed.social.playlist',
  FmTealAlphaFeedSocialPlaylistItem: 'fm.teal.alpha.feed.social.playlistItem',
  FmTealAlphaFeedSocialPost: 'fm.teal.alpha.feed.social.post',
  FmTealAlphaFeedSocialRepost: 'fm.teal.alpha.feed.social.repost',
  FmTealAlphaGraphFollow: 'fm.teal.alpha.graph.follow',
  FmTealAlphaGraphGetFollowers: 'fm.teal.alpha.graph.getFollowers',
  FmTealAlphaGraphGetFollows: 'fm.teal.alpha.graph.getFollows',
  FmTealAlphaGraphGetSummary: 'fm.teal.alpha.graph.getSummary',
  FmTealAlphaMusicDefs: 'fm.teal.alpha.music.defs',
  FmTealAlphaMusicGetAlbum: 'fm.teal.alpha.music.getAlbum',
  FmTealAlphaMusicGetArtist: 'fm.teal.alpha.music.getArtist',
  FmTealAlphaMusicGetArtistListeners: 'fm.teal.alpha.music.getArtistListeners',
  FmTealAlphaRichtextFacet: 'fm.teal.alpha.richtext.facet',
  FmTealAlphaSearchDefs: 'fm.teal.alpha.search.defs',
  FmTealAlphaSearchGetResults: 'fm.teal.alpha.search.getResults',
  FmTealAlphaStatsDefs: 'fm.teal.alpha.stats.defs',
  FmTealAlphaStatsGetLatest: 'fm.teal.alpha.stats.getLatest',
  FmTealAlphaStatsGetTopArtists: 'fm.teal.alpha.stats.getTopArtists',
  FmTealAlphaStatsGetTopReleases: 'fm.teal.alpha.stats.getTopReleases',
  FmTealAlphaStatsGetUserTopArtists: 'fm.teal.alpha.stats.getUserTopArtists',
  FmTealAlphaStatsGetUserTopReleases: 'fm.teal.alpha.stats.getUserTopReleases',
  AppBskyRichtextFacet: 'app.bsky.richtext.facet',
}
