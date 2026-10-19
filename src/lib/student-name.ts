// A conta (User.name) de um aluno pertence ao RESPONSÁVEL; o nome do aluno
// fica em StudentProfile.studentName. Professores e telas de turma devem
// exibir o nome do aluno — esta é a regra única, com fallback para o nome da
// conta (cadastros antigos ou campo vazio). Professores/admins não têm
// studentProfile, então continuam com o próprio nome.
export type WithStudentProfile = {
  name: string;
  studentProfile?: { studentName?: string | null } | null;
};

export function studentDisplayName(user: WithStudentProfile): string {
  return user.studentProfile?.studentName?.trim() || user.name;
}

// Troca `name` pelo nome de exibição e remove o studentProfile do objeto
// (não precisa ir ao browser).
export function withStudentDisplayName<T extends WithStudentProfile>(
  user: T
): Omit<T, "studentProfile"> {
  const { studentProfile: _studentProfile, ...rest } = user;
  return { ...rest, name: studentDisplayName(user) };
}
