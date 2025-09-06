import { supabase } from '../lib/supabase';

export const studentService = {
  // Get all students
  async getAllStudents() {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, username, email, code, role, created_at, updated_at')
      .eq('role', 'student')
      .order('name', { ascending: true });

    if (error) throw error;
    return data;
  },

  // Get students enrolled in a specific level
  async getEnrolledStudents(levelCode) {
    const { data, error } = await supabase
      .from('student_enrollment')
      .select(`
        *,
        student:users (
          id,
          name,
          username,
          email,
          code,
          role,
          created_at,
          updated_at
        )
      `)
      .eq('level_code', levelCode)
      .order('enrolled_at', { ascending: true });

    if (error) throw error;
    return data.map(item => item.student);
  },

  // Create a new student
  async createStudent(studentData) {
    const { data, error } = await supabase
      .from('users')
      .insert([{
        name: studentData.name,
        username: studentData.username,
        email: studentData.email,
        code: studentData.code,
        role: 'student',
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Enroll a student in a level
  async enrollStudent(studentId, levelCode) {
    const { data, error } = await supabase
      .from('student_enrollment')
      .insert([{
        student_id: studentId,
        level_code: levelCode,
        enrolled_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Create and enroll a new student
  async createAndEnrollStudent(studentData, levelCode) {
    // First create the student
    const student = await this.createStudent(studentData);
    
    // Then enroll them
    const enrollment = await this.enrollStudent(student.id, levelCode);
    
    return { student, enrollment };
  },

  // Enroll multiple existing students
  async enrollMultipleStudents(studentIds, levelCode) {
    const enrollments = studentIds.map(studentId => ({
      student_id: studentId,
      level_code: levelCode,
      enrolled_at: new Date().toISOString()
    }));

    const { data, error } = await supabase
      .from('student_enrollment')
      .insert(enrollments)
      .select();

    if (error) throw error;
    return data;
  },

  // Remove a student from a level
  async removeStudentFromLevel(studentId, levelCode) {
    const { error } = await supabase
      .from('student_enrollment')
      .delete()
      .eq('student_id', studentId)
      .eq('level_code', levelCode);

    if (error) throw error;
  },

  // Update student information
  async updateStudent(studentId, updateData) {
    const { data, error } = await supabase
      .from('users')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', studentId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Search students
  async searchStudents(searchTerm) {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, username, email, code, role')
      .eq('role', 'student')
      .or(`name.ilike.%${searchTerm}%,username.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,code.ilike.%${searchTerm}%`)
      .order('name', { ascending: true });

    if (error) throw error;
    return data;
  },

  // Get students not enrolled in a specific level
  async getUnenrolledStudents(levelCode) {
    // First get all students
    const allStudents = await this.getAllStudents();
    
    // Then get enrolled students for this level
    const enrolledStudents = await this.getEnrolledStudents(levelCode);
    const enrolledIds = enrolledStudents.map(s => s.id);
    
    // Return students not enrolled
    return allStudents.filter(student => !enrolledIds.includes(student.id));
  },

  // Get enrollment statistics
  async getEnrollmentStats(levelCode) {
    const enrolledStudents = await this.getEnrolledStudents(levelCode);
    const allStudents = await this.getAllStudents();
    
    return {
      totalStudents: allStudents.length,
      enrolledStudents: enrolledStudents.length,
      unenrolledStudents: allStudents.length - enrolledStudents.length
    };
  }
};

export default studentService;
