use serde::{Deserialize, Deserializer, Serialize};

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    Account,
    Identity,
    Commit,
    Unknown(String),
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct Event<T> {
    pub did: String,
    pub time_us: Option<u64>,
    pub kind: Kind,
    pub commit: Option<Commit<T>>,
    pub identity: Option<Identity>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Identity {
    did: String,
    handle: Option<String>,
    seq: u64,
    time: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
enum AccountStatus {
    TakenDown,
    Suspended,
    Deleted,
    Activated,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Account {
    did: String,
    handle: String,
    seq: u64,
    time: String,
    status: AccountStatus,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Commit<T> {
    pub rev: String,
    pub operation: Operation,
    pub collection: String,
    pub rkey: String,
    pub record: Option<T>,
    pub cid: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Operation {
    Create,
    Update,
    Delete,
}

/// Enforce that record is None only when operation is 'delete'
impl<'de, T> Deserialize<'de> for Commit<T>
where
    T: Deserialize<'de>,
{
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        // Helper struct to perform the deserialization.
        #[derive(Deserialize)]
        #[serde(rename_all = "camelCase")]
        struct Helper<T> {
            rev: String,
            operation: Operation,
            collection: String,
            rkey: String,
            record: Option<T>,
            cid: Option<String>,
        }

        let helper = Helper::deserialize(deserializer)?;

        match helper.operation {
            Operation::Delete => {
                if helper.record.is_some() || helper.cid.is_some() {
                    return Err(<D::Error as serde::de::Error>::custom(
                        "record and cid must be null when operation is delete",
                    ));
                }
            }
            _ => {
                if helper.record.is_none() || helper.cid.is_none() {
                    return Err(<D::Error as serde::de::Error>::custom(
                        "record and cid must be present unless operation is delete",
                    ));
                }
            }
        }

        Ok(Commit {
            rev: helper.rev,
            operation: helper.operation,
            collection: helper.collection,
            rkey: helper.rkey,
            record: helper.record,
            cid: helper.cid,
        })
    }
}
