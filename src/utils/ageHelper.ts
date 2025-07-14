export const calculateAge = (birthDate: Date): string => {
  const today = new Date();
  const birth = new Date(birthDate);

  let years = today.getFullYear() - birth.getFullYear();
  let months = today.getMonth() - birth.getMonth();
  let days = today.getDate() - birth.getDate();

  // Adjust for negative days
  if (days < 0) {
    months--;
    const lastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    days += lastMonth.getDate();
  }

  // Adjust for negative months
  if (months < 0) {
    years--;
    months += 12;
  }

  // Format the age string
  const parts: string[] = [];

  if (years > 0) {
    parts.push(`${years} year${years !== 1 ? "s" : ""}`);
  }

  if (months > 0) {
    parts.push(`${months} month${months !== 1 ? "s" : ""}`);
  }

  if (days > 0 && years === 0) {
    parts.push(`${days} day${days !== 1 ? "s" : ""}`);
  }

  return parts.length > 0 ? parts.join(", ") : "0 days";
};

export const getAgeInMonths = (birthDate: Date): number => {
  const today = new Date();
  const birth = new Date(birthDate);

  const yearDiff = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  return yearDiff * 12 + monthDiff;
};

export const getAgeCategory = (
  birthDate: Date
): "puppy" | "young" | "adult" | "senior" => {
  const ageInMonths = getAgeInMonths(birthDate);

  if (ageInMonths < 6) return "puppy";
  if (ageInMonths < 24) return "young";
  if (ageInMonths < 84) return "adult"; // 7 years
  return "senior";
};

export const isValidBirthDate = (birthDate: Date): boolean => {
  const today = new Date();
  const birth = new Date(birthDate);

  // Birth date cannot be in the future
  if (birth > today) return false;

  // Birth date cannot be more than 30 years ago (reasonable for pets)
  const thirtyYearsAgo = new Date();
  thirtyYearsAgo.setFullYear(today.getFullYear() - 30);

  return birth >= thirtyYearsAgo;
};
