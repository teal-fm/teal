use anyhow::{Context, Result, anyhow};
use reqwest::{Client, Response};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::PgPool;

use crate::{db, jetstream::STATUS_COLLECTIONS};

const PLAN_PATH: &str = "/xrpc/network.bsky.jetstream.planSnapshot";
const SEGMENT_PATH: &str = "/xrpc/network.bsky.jetstream.getSegment";

pub async fn backfill(pool: &PgPool, client: &Client, endpoint: &str, api_key: &str) -> Result<()> {
    let endpoint = endpoint.trim_end_matches('/');
    let (saved_tip, mut after_seq) = db::load_replay_progress(pool).await?.unwrap_or((0, 0));
    let mut sealed_tip = (saved_tip != 0).then_some(saved_tip);

    loop {
        let plan = plan_page(client, endpoint, api_key, after_seq, sealed_tip).await?;
        let tip = *sealed_tip.get_or_insert(plan.sealed_tip_seq);
        if tip != plan.sealed_tip_seq {
            return Err(anyhow!(
                "Jetstream sealed tip changed during backfill: expected {tip}, got {}",
                plan.sealed_tip_seq
            ));
        }

        tracing::info!(
            after_seq,
            planned_through_seq = plan.planned_through_seq,
            sealed_tip = tip,
            segments = plan.segments.len(),
            "Processing Jetstream Replay page"
        );

        let mut segments = plan.segments;
        segments.sort_by_key(|segment| segment.index);
        for segment in segments {
            if segment.max_seq <= after_seq {
                continue;
            }
            process_segment_plan(pool, client, endpoint, api_key, &segment).await?;
            after_seq = segment.max_seq;
            db::save_replay_progress(pool, tip, after_seq).await?;
        }

        if plan.planned_through_seq <= after_seq && after_seq < tip {
            return Err(anyhow!(
                "Jetstream Replay made no progress at sequence {after_seq}"
            ));
        }
        after_seq = plan.planned_through_seq.max(after_seq);
        db::save_replay_progress(pool, tip, after_seq).await?;
        if after_seq >= tip {
            db::save_cursor(pool, tip).await?;
            db::clear_replay_progress(pool).await?;
            tracing::info!(cursor = tip, "Jetstream Replay backfill complete");
            return Ok(());
        }
    }
}

async fn plan_page(
    client: &Client,
    endpoint: &str,
    api_key: &str,
    after_seq: u64,
    before_seq: Option<u64>,
) -> Result<PlanResponse> {
    let request = PlanRequest {
        dids: Vec::new(),
        collections: STATUS_COLLECTIONS
            .iter()
            .map(|collection| (*collection).to_string())
            .collect(),
        after_seq,
        before_seq,
    };
    loop {
        let response = client
            .post(format!("{endpoint}{PLAN_PATH}"))
            .bearer_auth(api_key)
            .json(&request)
            .send()
            .await?;
        if response.status().as_u16() == 429 {
            wait_for_rate_limit(response).await;
            continue;
        }
        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(anyhow!(
                "Jetstream Replay plan request failed: {status}: {body}"
            ));
        }
        return Ok(response.json().await?);
    }
}

async fn process_segment_plan(
    pool: &PgPool,
    client: &Client,
    endpoint: &str,
    api_key: &str,
    segment: &SegmentPlan,
) -> Result<()> {
    match segment.mode.as_str() {
        "blocks" => {
            let block_index = load_block_index(client, endpoint, api_key, &segment.name).await?;
            for block_range in segment.blocks.as_deref().unwrap_or_default() {
                process_block_range(
                    pool,
                    client,
                    endpoint,
                    api_key,
                    &segment.name,
                    &block_index,
                    block_range.first,
                    block_range.last,
                )
                .await?;
            }
        }
        "segment" => {
            let block_index = load_block_index(client, endpoint, api_key, &segment.name).await?;
            if let Some(last) = block_index.len().checked_sub(1) {
                process_block_range(
                    pool,
                    client,
                    endpoint,
                    api_key,
                    &segment.name,
                    &block_index,
                    0,
                    last as u64,
                )
                .await?;
            }
        }
        mode => return Err(anyhow!("unsupported Jetstream Replay mode: {mode}")),
    }

    Ok(())
}

async fn get_archive_bytes(
    client: &Client,
    url: &str,
    query: Vec<(&str, String)>,
    api_key: &str,
    range: Option<String>,
    context: String,
) -> Result<Vec<u8>> {
    loop {
        let mut request = client.get(url).query(&query).bearer_auth(api_key);
        if let Some(range) = &range {
            request = request.header(reqwest::header::RANGE, range);
        }
        let response = request.send().await?;
        if response.status().as_u16() == 429 {
            wait_for_rate_limit(response).await;
            continue;
        }

        return Ok(response
            .error_for_status()
            .with_context(|| context.clone())?
            .bytes()
            .await?
            .to_vec());
    }
}

async fn wait_for_rate_limit(response: Response) {
    let retry_after = response
        .headers()
        .get(reqwest::header::RETRY_AFTER)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse::<u64>().ok())
        .unwrap_or(5);
    tracing::warn!(retry_after, "Jetstream Replay rate limited; waiting");
    tokio::time::sleep(std::time::Duration::from_secs(retry_after)).await;
}

async fn load_block_index(
    client: &Client,
    endpoint: &str,
    api_key: &str,
    name: &str,
) -> Result<Vec<BlockInfo>> {
    let header = get_archive_bytes(
        client,
        &format!("{endpoint}{SEGMENT_PATH}"),
        vec![("name", name.to_string())],
        api_key,
        Some("bytes=0-255".to_string()),
        format!("Jetstream Replay segment header download failed: {name}"),
    )
    .await?;
    if header.len() < 256 || &header[..4] != b"jss0" {
        return Err(anyhow!("Jetstream segment has an invalid header: {name}"));
    }

    let block_count = read_u32_at(&header, 14)? as usize;
    let block_index_offset = read_u64_at(&header, 90)?;
    let block_index_len = u64::try_from(block_count)
        .ok()
        .and_then(|count| count.checked_mul(52))
        .ok_or_else(|| anyhow!("Jetstream block index is too large"))?;
    let block_index_end = block_index_offset
        .checked_add(block_index_len)
        .and_then(|end| end.checked_sub(1))
        .ok_or_else(|| anyhow!("Jetstream block index range overflow"))?;
    let block_index = get_archive_bytes(
        client,
        &format!("{endpoint}{SEGMENT_PATH}"),
        vec![("name", name.to_string())],
        api_key,
        Some(format!("bytes={block_index_offset}-{block_index_end}")),
        format!("Jetstream Replay block index download failed: {name}"),
    )
    .await?;
    if block_index.len() != block_index_len as usize {
        return Err(anyhow!("Jetstream block index is truncated: {name}"));
    }

    (0..block_count)
        .map(|index| {
            let entry = &block_index[index * 52..(index + 1) * 52];
            Ok(BlockInfo {
                offset: read_u64_at(entry, 0)?,
                compressed_size: u64::from(read_u32_at(entry, 8)?),
            })
        })
        .collect()
}

#[allow(clippy::too_many_arguments)]
async fn process_block_range(
    pool: &PgPool,
    client: &Client,
    endpoint: &str,
    api_key: &str,
    name: &str,
    block_index: &[BlockInfo],
    first: u64,
    last: u64,
) -> Result<()> {
    const BLOCKS_PER_REQUEST: u64 = 64;
    let last_index = u64::try_from(block_index.len())?
        .checked_sub(1)
        .ok_or_else(|| anyhow!("Jetstream segment has no blocks"))?;
    if first > last || last > last_index {
        return Err(anyhow!("Jetstream block range is outside its segment"));
    }

    let mut chunk_first = first;
    while chunk_first <= last {
        let chunk_last = chunk_first.saturating_add(BLOCKS_PER_REQUEST - 1).min(last);
        let first_info = &block_index[usize::try_from(chunk_first)?];
        let last_info = &block_index[usize::try_from(chunk_last)?];
        let range_start = first_info
            .offset
            .checked_add(8)
            .ok_or_else(|| anyhow!("Jetstream block range overflow"))?;
        let range_end = last_info
            .offset
            .checked_add(8)
            .and_then(|offset| offset.checked_add(last_info.compressed_size))
            .and_then(|end| end.checked_sub(1))
            .ok_or_else(|| anyhow!("Jetstream block range overflow"))?;
        let compressed = get_archive_bytes(
            client,
            &format!("{endpoint}{SEGMENT_PATH}"),
            vec![("name", name.to_string())],
            api_key,
            Some(format!("bytes={range_start}-{range_end}")),
            format!(
                "Jetstream Replay block range download failed: {name}:{chunk_first}-{chunk_last}"
            ),
        )
        .await?;

        let mut offset = 0usize;
        for index in chunk_first..=chunk_last {
            let block = &block_index[usize::try_from(index)?];
            let size = usize::try_from(block.compressed_size)?;
            let end = offset
                .checked_add(size)
                .ok_or_else(|| anyhow!("Jetstream block response overflow"))?;
            let bytes = compressed
                .get(offset..end)
                .ok_or_else(|| anyhow!("Jetstream block response is truncated"))?;
            process_block(pool, bytes)
                .await
                .with_context(|| format!("Jetstream block decode failed: {name}:{index}"))?;
            offset = end;
            if index < chunk_last {
                offset = offset
                    .checked_add(8)
                    .ok_or_else(|| anyhow!("Jetstream block response overflow"))?;
            }
        }
        if offset != compressed.len() {
            return Err(anyhow!("Jetstream block response has trailing bytes"));
        }
        chunk_first = chunk_last.saturating_add(1);
    }

    Ok(())
}

async fn process_block(pool: &PgPool, compressed: &[u8]) -> Result<()> {
    for event in decode_block(compressed)? {
        if !STATUS_COLLECTIONS.contains(&event.collection.as_str()) {
            continue;
        }

        // Jetstream archive kinds are 1=create, 2=update, 3=delete, and
        // 7=create-resync; kind 7 materializes a record and folds as create.
        let (operation, record) = match event.kind {
            1 | 7 => (
                "create",
                Some(
                    serde_ipld_dagcbor::from_slice::<Value>(&event.payload)
                        .context("status create payload is not valid DAG-CBOR")?,
                ),
            ),
            2 => (
                "update",
                Some(
                    serde_ipld_dagcbor::from_slice::<Value>(&event.payload)
                        .context("status update payload is not valid DAG-CBOR")?,
                ),
            ),
            3 => ("delete", None),
            _ => continue,
        };

        let revision = (!event.revision.is_empty()).then_some(event.revision.as_str());
        db::apply_status_event(
            pool,
            &event.did,
            operation,
            &event.collection,
            &event.rkey,
            revision,
            record,
        )
        .await?;
    }

    Ok(())
}

fn decode_block(compressed: &[u8]) -> Result<Vec<ArchiveEvent>> {
    let body = zstd::stream::decode_all(compressed)?;
    let mut offset = 0;
    let count = read_u32(&body, &mut offset)? as usize;
    skip_column(&body, &mut offset, count, 8)?;
    skip_column(&body, &mut offset, count, 8)?;
    skip_column(&body, &mut offset, count, 8)?;
    let kinds = take(&body, &mut offset, count)?.to_vec();
    let collection_lengths = take(&body, &mut offset, count)?.to_vec();
    let did_lengths = read_u16_column(&body, &mut offset, count)?;
    let rkey_lengths = take(&body, &mut offset, count)?.to_vec();
    let revision_lengths = take(&body, &mut offset, count)?.to_vec();
    let payload_lengths = read_u32_column(&body, &mut offset, count)?;

    let collections = take(&body, &mut offset, total_len(&collection_lengths)?)?;
    let dids = take(&body, &mut offset, total_len(&did_lengths)?)?;
    let rkeys = take(&body, &mut offset, total_len(&rkey_lengths)?)?;
    let revisions = take(&body, &mut offset, total_len(&revision_lengths)?)?;
    let payloads = take(&body, &mut offset, total_len(&payload_lengths)?)?;

    let mut collection_offset = 0;
    let mut did_offset = 0;
    let mut rkey_offset = 0;
    let mut revision_offset = 0;
    let mut payload_offset = 0;
    let mut events = Vec::with_capacity(count);

    for index in 0..count {
        let collection = read_string(
            collections,
            &mut collection_offset,
            collection_lengths[index] as usize,
        )?;
        let did = read_string(dids, &mut did_offset, did_lengths[index] as usize)?;
        let rkey = read_string(rkeys, &mut rkey_offset, rkey_lengths[index] as usize)?;
        let revision = read_string(
            revisions,
            &mut revision_offset,
            revision_lengths[index] as usize,
        )?;
        let payload = take(
            payloads,
            &mut payload_offset,
            payload_lengths[index] as usize,
        )?
        .to_vec();

        events.push(ArchiveEvent {
            kind: kinds[index],
            collection,
            did,
            rkey,
            revision,
            payload,
        });
    }

    Ok(events)
}

fn read_u64_at(bytes: &[u8], offset: usize) -> Result<u64> {
    let bytes = bytes
        .get(offset..offset + 8)
        .ok_or_else(|| anyhow!("Jetstream segment is truncated"))?;
    Ok(u64::from_le_bytes(bytes.try_into()?))
}

fn read_u32_at(bytes: &[u8], offset: usize) -> Result<u32> {
    let bytes = bytes
        .get(offset..offset + 4)
        .ok_or_else(|| anyhow!("Jetstream segment is truncated"))?;
    Ok(u32::from_le_bytes(bytes.try_into()?))
}

fn read_u32(bytes: &[u8], offset: &mut usize) -> Result<u32> {
    let bytes = take(bytes, offset, 4)?;
    Ok(u32::from_le_bytes(bytes.try_into()?))
}

fn read_u16_column(bytes: &[u8], offset: &mut usize, count: usize) -> Result<Vec<u16>> {
    (0..count).map(|_| read_u16(bytes, offset)).collect()
}

fn read_u16(bytes: &[u8], offset: &mut usize) -> Result<u16> {
    let bytes = take(bytes, offset, 2)?;
    Ok(u16::from_le_bytes(bytes.try_into()?))
}

fn read_u32_column(bytes: &[u8], offset: &mut usize, count: usize) -> Result<Vec<u32>> {
    (0..count).map(|_| read_u32(bytes, offset)).collect()
}

fn skip_column(bytes: &[u8], offset: &mut usize, count: usize, width: usize) -> Result<()> {
    let length = count
        .checked_mul(width)
        .context("Jetstream column overflow")?;
    take(bytes, offset, length)?;
    Ok(())
}

fn total_len<T>(lengths: &[T]) -> Result<usize>
where
    T: Copy + Into<u64>,
{
    let total = lengths.iter().try_fold(0u64, |total, length| {
        total
            .checked_add((*length).into())
            .context("Jetstream variable column overflow")
    })?;
    usize::try_from(total).context("Jetstream variable column is too large")
}

fn take<'a>(bytes: &'a [u8], offset: &mut usize, length: usize) -> Result<&'a [u8]> {
    let end = offset
        .checked_add(length)
        .context("Jetstream block offset overflow")?;
    let result = bytes
        .get(*offset..end)
        .ok_or_else(|| anyhow!("Jetstream block is truncated"))?;
    *offset = end;
    Ok(result)
}

fn read_string(bytes: &[u8], offset: &mut usize, length: usize) -> Result<String> {
    Ok(String::from_utf8(take(bytes, offset, length)?.to_vec())?)
}

#[derive(Debug, Serialize)]
struct PlanRequest {
    dids: Vec<String>,
    collections: Vec<String>,
    #[serde(rename = "afterSeq")]
    after_seq: u64,
    #[serde(rename = "beforeSeq", skip_serializing_if = "Option::is_none")]
    before_seq: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct PlanResponse {
    #[serde(rename = "plannedThroughSeq")]
    planned_through_seq: u64,
    #[serde(rename = "sealedTipSeq")]
    sealed_tip_seq: u64,
    segments: Vec<SegmentPlan>,
}

#[derive(Debug, Deserialize)]
struct SegmentPlan {
    name: String,
    index: u64,
    #[serde(rename = "maxSeq")]
    max_seq: u64,
    mode: String,
    blocks: Option<Vec<BlockRange>>,
}

#[derive(Debug, Deserialize)]
struct BlockRange {
    first: u64,
    last: u64,
}

#[derive(Debug)]
struct BlockInfo {
    offset: u64,
    compressed_size: u64,
}

#[derive(Debug)]
struct ArchiveEvent {
    kind: u8,
    collection: String,
    did: String,
    rkey: String,
    revision: String,
    payload: Vec<u8>,
}
