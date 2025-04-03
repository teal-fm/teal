import { Text } from './text';

const Ago = ({ time }: { time: Date }) => {
  return (
    <Text className="text-gray-500 text-sm">{timeAgoSinceDate(time)}</Text>
  );
};

/**
 * Calculates a human-readable string representing how long ago a date occurred relative to now.
 * Mimics the behavior of the provided Dart function.
 *
 * @param createdDate The date to compare against the current time.
 * @param numericDates If true, uses numeric representations like "1 minute ago", otherwise uses text like "A minute ago". Defaults to true.
 * @returns A string describing the time elapsed since the createdDate.
 */
function timeAgoSinceDate(
  createdDate: Date,
  numericDates: boolean = true,
): string {
  const now = new Date();
  const differenceInMs = now.getTime() - createdDate.getTime();

  const seconds = Math.floor(differenceInMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 5) {
    return 'Just now';
  } else if (seconds <= 60) {
    return `${seconds} seconds ago`;
  } else if (minutes <= 1) {
    return numericDates ? '1 minute ago' : 'A minute ago';
  } else if (minutes <= 60) {
    return `${minutes} minutes ago`;
  } else if (hours <= 1) {
    return numericDates ? '1 hour ago' : 'An hour ago';
  } else if (hours <= 60) {
    return `${hours} hours ago`;
  } else if (days <= 1) {
    return numericDates ? '1 day ago' : 'Yesterday';
  } else if (days <= 6) {
    return `${days} days ago`;
  } else if (Math.ceil(days / 7) <= 1) {
    return numericDates ? '1 week ago' : 'Last week';
  } else if (Math.ceil(days / 7) <= 4) {
    return `${Math.ceil(days / 7)} weeks ago`;
  } else if (Math.ceil(days / 30) <= 1) {
    return numericDates ? '1 month ago' : 'Last month';
  } else if (Math.ceil(days / 30) <= 30) {
    return `${Math.ceil(days / 30)} months ago`;
  } else if (Math.ceil(days / 365) <= 1) {
    return numericDates ? '1 year ago' : 'Last year';
  } else {
    return `${Math.floor(days / 365)} years ago`;
  }
}
