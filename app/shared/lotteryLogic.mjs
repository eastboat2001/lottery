export function drawAllWinners(participants, prizes, random = Math.random, date = new Date()) {
  const availableParticipants = participants
    .map((participant) => ({
      employeeId: String(participant?.employeeId ?? "").trim(),
      name: String(participant?.name ?? "").trim(),
    }))
    .filter((participant) => participant.employeeId && participant.name);
  if (availableParticipants.length === 0) {
    throw new Error("请先导入抽奖名单");
  }

  const prizeSlots = prizes.flatMap((prize) =>
    Array.from({ length: Math.max(0, Math.trunc(Number(prize?.remainingQty) || 0)) }, () => ({
      prizeName: String(prize?.name ?? "").trim(),
    })),
  ).filter((slot) => slot.prizeName);
  if (prizeSlots.length === 0) {
    throw new Error("奖品已抽完");
  }

  const shuffledParticipants = shuffle(availableParticipants, random);
  const shuffledSlots = shuffle(prizeSlots, random);
  const winnerCount = Math.min(shuffledParticipants.length, shuffledSlots.length);
  const time = formatNow(date);
  const records = Array.from({ length: winnerCount }, (_, index) => ({
    employeeId: shuffledParticipants[index].employeeId,
    name: shuffledParticipants[index].name,
    prizeName: shuffledSlots[index].prizeName,
    time,
  }));
  const awardedCounts = records.reduce((counts, record) => {
    counts.set(record.prizeName, (counts.get(record.prizeName) || 0) + 1);
    return counts;
  }, new Map());

  return {
    records,
    prizes: prizes.map((prize) => ({
      ...prize,
      remainingQty: Math.max(0, Math.trunc(Number(prize.remainingQty) || 0) - (awardedCounts.get(prize.name) || 0)),
    })),
  };
}

export function formatNow(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    " ",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
    ":",
    pad(date.getSeconds()),
  ].join("");
}

function shuffle(values, random) {
  const shuffled = values.map((value) => ({ ...value }));
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = index - Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}
